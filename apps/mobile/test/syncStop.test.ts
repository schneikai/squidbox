import type { PullResponse, PushRequest, PushResponse } from '@squidbox/shared';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { getCursor, isFirstSyncDone } from '../src/sync/status';
import type { SyncTransport } from '../src/sync/transport';
import { APPLY_BATCH, runSyncOnce } from '../src/sync/worker';

let db: SyncDb;
beforeEach(() => {
  db = makeTestDb();
});

// A server with `total` asset records, served in pages of 1000.
function server(total: number, onPull: (cursor: number) => void = () => {}): SyncTransport {
  return {
    push: async (req: PushRequest): Promise<PushResponse> => ({
      results: req.mutations.map((m) => ({ id: String(m.record.id), collection: m.collection, status: 'applied' })),
    }),
    pull: async ({ cursor }): Promise<PullResponse> => {
      onPull(cursor);
      const records = Array.from({ length: Math.min(1000, total - cursor) }, (_, i) =>
        makeAssetRecord({ id: `00000000-0000-4000-8000-${String(cursor + i + 1).padStart(12, '0')}` }),
      );
      const next = cursor + records.length;
      return { changes: { assets: { records } }, cursor: next, hasMore: next < total };
    },
  };
}

describe('a stop request', () => {
  it('ends a pull after the current applied batch, with its cursor committed', async () => {
    let stop = false;
    const pulls: number[] = [];
    const transport = server(APPLY_BATCH * 2, (cursor) => {
      pulls.push(cursor);
      if (cursor === 2000) stop = true; // requested while the first batch is still being fetched
    });

    await runSyncOnce(db, transport, { shouldStop: () => stop });

    expect(await getCursor(db)).toBe(APPLY_BATCH);
    expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH);
    expect(await isFirstSyncDone(db)).toBe(false);
    expect(pulls).toEqual([0, 1000, 2000, 3000, 4000]);

    stop = false;
    await runSyncOnce(db, transport); // the next run resumes from the committed cursor
    expect(await getCursor(db)).toBe(APPLY_BATCH * 2);
    expect(await isFirstSyncDone(db)).toBe(true);
  });

  it('ends a push between batches, keeping the rest of the outbox', async () => {
    await repo.createAssets(
      db,
      Array.from({ length: 1001 }, () => makeAssetRecord()),
    );
    let stop = false;
    const transport = server(0);
    const push = transport.push;
    transport.push = async (req) => {
      stop = true;
      return push(req);
    };

    await runSyncOnce(db, transport, { shouldStop: () => stop });

    expect(await db.select().from(schema.outbox)).toHaveLength(501);
    expect(await isFirstSyncDone(db)).toBe(false);
  });
});
