import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { postCollection } from '@squidbox/shared';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(async (_db: unknown, id: string) => ({ id, email: 'a@b.co', storageBucket: null })),
  toApiUser: (u: { id: string; email: string }) => ({ id: u.id, email: u.email }),
}));
const pushed = vi.hoisted(() => ({ count: 0 }));
vi.mock('../src/sync/push.js', () => ({
  push: vi.fn(async (_db: unknown, _userId: string, mutations: { record: { id: string }; collection: string }[]) => {
    pushed.count += mutations.length;
    return mutations.map((m) => ({ id: m.record.id, collection: m.collection, status: 'applied' }));
  }),
}));
vi.mock('../src/sync/purgedFiles.js', () => ({ cleanUpPurgedFiles: () => {} }));

import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';

// Round 6: the client splits its pushes at 512 KB of mutations, "half the server's 1 MiB body limit,
// so a batch of large records is never refused for good" (sync-design §6). A single record over the
// limit still goes alone, and the server refuses it before the handler, whatever its schema says.
describe('POST /sync/push and the 1 MiB body limit', () => {
  const headers = { authorization: `Bearer ${signAccessToken('u1')}`, 'content-type': 'application/json' };
  const post = (text: string) => ({
    id: randomUUID(),
    createdAt: 1,
    updatedAt: 2,
    deletedAt: null,
    text,
    isFavorite: false,
    postedAt: null,
    rePostId: null,
    isIgnoredForRepost: false,
    suggestRepostAt: 1,
    hasBeenReposted: false,
  });
  const push = async (record: Record<string, unknown>) =>
    (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/sync/push',
      headers,
      payload: JSON.stringify({ mutations: [{ collection: 'posts', record, fields: { text: 2 } }] }),
    });

  it('takes one post of 900 KB of text, and refuses one of 1.1 MB with a 413 its schema would accept', async () => {
    const fits = post('x'.repeat(900 * 1024));
    expect((await push(fits)).statusCode).toBe(200);
    expect(pushed.count).toBe(1);

    const tooBig = post('é'.repeat(560 * 1024)); // 1.1 MB in UTF-8
    expect(postCollection.schema.safeParse(tooBig).success).toBe(true);
    const res = await push(tooBig);
    expect(res.statusCode).toBe(413);
    expect(pushed.count).toBe(1); // never reached the merge: no per-row result, the request fails whole
  });
});
