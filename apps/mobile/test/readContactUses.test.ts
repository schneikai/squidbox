import { describe, expect, it } from 'vitest';

import { createPost, makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as assets from '../src/sync/assetsRepository';
import { contactLinks } from '../src/sync/membershipRepository';
import readContactUses from '../src/sync/queries/readContactUses';

describe('readContactUses', () => {
  it('counts the live photos a contact is tagged on and the live posts that mention it', async () => {
    const db = makeTestDb();
    let n = 0;
    await assets.createMany(db, [makeAssetRecord({ id: 'a1' }), makeAssetRecord({ id: 'gone', deletedAt: 5 })]);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'a1' }, ['sam'], () => `edge-${++n}`);
    await contactLinks.add(db, { targetType: 'asset', targetId: 'gone' }, ['sam'], () => `edge-${++n}`);
    const sam = { contactId: 'sam', location: 5, name: 'Sam' };
    await createPost(db, { id: 'p1', text: 'With Sam', mentions: [sam] });
    await createPost(db, { id: 'p2', text: 'With Sam', mentions: [sam], deletedAt: 5 });
    await createPost(db, { id: 'p3', text: 'With Ben', mentions: [{ contactId: 'ben', location: 5, name: 'Ben' }] });

    expect(await readContactUses(db, 'sam')).toEqual({ photos: 1, posts: 1 });
    expect(await readContactUses(db, 'nobody')).toEqual({ photos: 0, posts: 0 });
  });
});
