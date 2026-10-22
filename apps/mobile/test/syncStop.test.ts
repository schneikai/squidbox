import type { PullResponse, PushRequest, PushResponse } from '@squidbox/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { startRun } from '../src/sync/runGate';
import { getCursor, isFirstSyncDone } from '../src/sync/status';
import type { SyncTransport } from '../src/sync/transport';
import { APPLY_BATCH, runSyncOnce, setSyncTarget, withSyncPaused, type SyncTarget } from '../src/sync/worker';
import SessionChangedError from '../src/utils/cloud-api/SessionChangedError';

// The production sync runs' transport and file removal (withSyncRun).
const transportImpl = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../src/sync/transport', () => ({ httpTransport: () => transportImpl.current }));
vi.mock('../src/library/fs', () => ({ purgedFilesRemover: () => async () => {} }));

let db: AppDb;
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

describe('withSyncPaused', () => {
  it('lets no run start while its work runs, aborts and awaits the running ones, and resumes after a throw', async () => {
    let aborted = false;
    let ended = false;
    const run = startRun(async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
      aborted = true;
      await new Promise((resolve) => setTimeout(resolve, 5));
      ended = true;
    });
    expect(run).not.toBeNull();

    let during: Promise<void> | null | undefined;
    await withSyncPaused(async () => {
      expect(aborted && ended).toBe(true);
      during = startRun(async () => {});
    });
    expect(during).toBeNull();
    await expect(withSyncPaused(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(startRun(async () => {})).not.toBeNull();
  });

  // A merge's paused section (usePendingMerges) can start while a sync run pushes: the run stops,
  // and a new one runs what it cut short once the section ends.
  it('runs a sync again after the section when it aborted one', async () => {
    await repo.createAssets(
      db,
      Array.from({ length: 1001 }, () => makeAssetRecord()),
    );
    const base = server(0);
    let pushing!: () => void;
    const firstPush = new Promise<void>((resolve) => (pushing = resolve));
    transportImpl.current = {
      ...base,
      push: async (req: PushRequest) => {
        pushing();
        await new Promise((resolve) => setTimeout(resolve, 5));
        return base.push(req);
      },
    };
    setSyncTarget({ db, identity: {}, library: {} } as SyncTarget); // starts a run

    await firstPush;
    await withSyncPaused(async () => {
      expect(await db.select().from(schema.outbox)).toHaveLength(501); // stopped after its first batch
    });

    await vi.waitFor(async () => expect(await db.select().from(schema.outbox)).toHaveLength(0));
    await withSyncPaused(async () => setSyncTarget(null));
  });

  // Round 19: a sync queued just before a paused section starts finds the runs paused: it asks
  // again, and runs after the section.
  it('a sync held back by a pause runs after the section', async () => {
    await repo.createAsset(db, makeAssetRecord());
    transportImpl.current = server(0);
    setSyncTarget({ db, identity: {}, library: {} } as SyncTarget); // queues a run
    await withSyncPaused(async () => {}); // paused before that run starts

    await vi.waitFor(async () => expect(await db.select().from(schema.outbox)).toHaveLength(0));
    await withSyncPaused(async () => setSyncTarget(null));
  });

  it('a session that changed under a run ends it like an abort, not as a failure', async () => {
    await expect(startRun(async () => Promise.reject(new SessionChangedError()))).resolves.toBeUndefined();
    await expect(startRun(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
  });
});

describe('an aborted run', () => {
  it('ends a pull after the page at hand, applying what it has with its cursor committed', async () => {
    const controller = new AbortController();
    const pulls: number[] = [];
    const transport = server(APPLY_BATCH * 2, (cursor) => {
      pulls.push(cursor);
      if (cursor === 2000) controller.abort(); // requested while the first batch is still being fetched
    });

    await runSyncOnce(db, transport, { signal: controller.signal });

    expect(await getCursor(db)).toBe(3000);
    expect(await db.select().from(schema.assets)).toHaveLength(3000);
    expect(await isFirstSyncDone(db)).toBe(false);
    expect(pulls).toEqual([0, 1000, 2000]);

    await runSyncOnce(db, transport); // the next run resumes from the committed cursor
    expect(await getCursor(db)).toBe(APPLY_BATCH * 2);
    expect(await isFirstSyncDone(db)).toBe(true);
  });

  it('ends a push between batches, keeping the rest of the outbox', async () => {
    await repo.createAssets(
      db,
      Array.from({ length: 1001 }, () => makeAssetRecord()),
    );
    const controller = new AbortController();
    const transport = server(0);
    const push = transport.push;
    transport.push = async (req) => {
      controller.abort();
      return push(req);
    };

    await runSyncOnce(db, transport, { signal: controller.signal });

    expect(await db.select().from(schema.outbox)).toHaveLength(501);
    expect(await isFirstSyncDone(db)).toBe(false);
  });
});

describe('a pull downloading the next batch while it applies one', () => {
  const withPull = (transport: SyncTransport, pull: SyncTransport['pull']): SyncTransport => ({ ...transport, pull });

  it('requests the next batch before the current one commits, and commits them in order', async () => {
    const log: string[] = [];
    const transport = server(APPLY_BATCH * 2, (cursor) => log.push(`pull ${cursor}`));
    db.onTablesChanged((tables) => {
      if (tables.has('assets')) log.push('commit');
    });

    await runSyncOnce(db, transport);

    expect(log.indexOf('pull 5000')).toBeLessThan(log.indexOf('commit'));
    expect(log.filter((entry) => entry.startsWith('pull'))).toEqual(
      Array.from({ length: 10 }, (_, i) => `pull ${i * 1000}`),
    );
    expect(log.filter((entry) => entry === 'commit')).toHaveLength(2);
    expect(await getCursor(db)).toBe(APPLY_BATCH * 2);
    expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH * 2);
  });

  it('keeps the cursor of the last applied batch when an apply fails, dropping the download meanwhile', async () => {
    const base = server(APPLY_BATCH * 3);
    const transport = withPull(base, async (req) => {
      if (req.cursor >= APPLY_BATCH * 2) {
        await new Promise((resolve) => setTimeout(resolve, 20)); // fails after the run has ended
        throw new Error('offline');
      }
      const page = await base.pull(req);
      if (req.cursor === APPLY_BATCH) (page.changes.assets!.records[0] as { width: unknown }).width = null;
      return page;
    });

    await expect(runSyncOnce(db, transport)).rejects.toThrow('NOT NULL');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(await getCursor(db)).toBe(APPLY_BATCH);
    expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH);
  });

  it('fails a run whose next download fails only after the batch at hand commits', async () => {
    const base = server(APPLY_BATCH * 2);
    const transport = withPull(base, async (req) => {
      if (req.cursor >= APPLY_BATCH) throw new Error('offline');
      return base.pull(req);
    });

    await expect(runSyncOnce(db, transport)).rejects.toThrow('offline');

    expect(await getCursor(db)).toBe(APPLY_BATCH);
    expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH);
  });

  it.each(['answers', 'fails'])(
    'waits for the download of a run stopped during an apply, which then %s, without paging on or writing',
    async (outcome) => {
      const controller = new AbortController();
      const pulls: number[] = [];
      let isRunDone = false;
      let answeredBeforeRunDone = false;
      const base = server(APPLY_BATCH * 2);
      const transport = withPull(base, async (req) => {
        pulls.push(req.cursor);
        if (req.cursor < APPLY_BATCH) return base.pull(req);
        controller.abort(); // requested while the first batch is applied
        await new Promise((resolve) => setTimeout(resolve, 20));
        answeredBeforeRunDone = !isRunDone; // the run outlives its last request
        if (outcome === 'fails') throw new Error('offline');
        return base.pull(req);
      });

      await runSyncOnce(db, transport, { signal: controller.signal });
      isRunDone = true;
      expect(answeredBeforeRunDone).toBe(true);

      expect(pulls).toEqual([0, 1000, 2000, 3000, 4000, 5000]);
      expect(await getCursor(db)).toBe(APPLY_BATCH);
      expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH);
      expect(await isFirstSyncDone(db)).toBe(false);
    },
  );

  it('applies what the next batch has when a stop comes while the run waits for it', async () => {
    const controller = new AbortController();
    let committed = false;
    db.onTablesChanged((tables) => (committed ||= tables.has('assets')));
    const base = server(APPLY_BATCH * 2);
    const transport = withPull(base, async (req) => {
      while (req.cursor === APPLY_BATCH && !committed) await new Promise((resolve) => setTimeout(resolve, 1));
      if (req.cursor === APPLY_BATCH + 1000) controller.abort();
      return base.pull(req);
    });

    await runSyncOnce(db, transport, { signal: controller.signal });

    expect(await getCursor(db)).toBe(APPLY_BATCH + 2000);
    expect(await db.select().from(schema.assets)).toHaveLength(APPLY_BATCH + 2000);
    expect(await isFirstSyncDone(db)).toBe(false);
  });
});
