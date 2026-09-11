import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { collectionNames, keyBetween } from '@squidbox/shared';
import * as schema from '../src/db/schema.js';
import { serverCollections } from '../src/sync/collections.js';
import { push } from '../src/sync/push.js';
import { pull } from '../src/sync/pull.js';

// DB-backed integration tests (advisory locks, trigger, ON CONFLICT) — require a real
// Postgres. Run with `npm run test:db` (points at the docker-compose stack); plain `npm test`
// skips them.
const TEST_URL = process.env.TEST_DATABASE_URL;
const d = TEST_URL ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

type Db = ReturnType<typeof drizzle<typeof schema>>;
let pool: pg.Pool;
let db: Db;

function assetRecord(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    createdAt: 1000,
    updatedAt: 1000,
    deletedAt: null as number | null,
    mediaLibraryAssetId: 'm1',
    mediaType: 'photo',
    width: 100,
    height: 100,
    fileSize: 500,
    duration: null as number | null,
    filename: 'a.jpg',
    thumbnailFilename: 't.jpg',
    isFavorite: false,
    notes: null as string | null,
    oldFileId: null as string | null,
    isFileSynced: true,
    isThumbnailSynced: true,
    isSynced: true,
    ...over,
  };
}
const mut = (record: Record<string, unknown>) => ({ collection: 'assets', record });

async function serverSeqOf(userId: string, id: string): Promise<number | null> {
  const [row] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, userId), eq(schema.assets.id, id)));
  return row ? (row.serverSeq as number | null) : null;
}

d('sync engine (Postgres)', () => {
  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: TEST_URL });
    db = drizzle(pool, { schema });
    await db
      .insert(schema.users)
      .values([
        { id: USER_A, email: 'a-sync@test.local', passwordDigest: 'x', storageBucket: null },
        { id: USER_B, email: 'b-sync@test.local', passwordDigest: 'x', storageBucket: null },
      ])
      .onConflictDoNothing();
  });
  async function clearAll() {
    // Scope deletes to THIS test's users — vitest runs test files in parallel against the same
    // Postgres, so an unscoped delete would wipe other files' rows mid-test (a real race).
    const users = [USER_A, USER_B];
    await db.delete(schema.albumAssets).where(inArray(schema.albumAssets.userId, users));
    await db.delete(schema.postAssets).where(inArray(schema.postAssets.userId, users));
    await db.delete(schema.posts).where(inArray(schema.posts.userId, users));
    await db.delete(schema.albums).where(inArray(schema.albums.userId, users));
    await db.delete(schema.assets).where(inArray(schema.assets.userId, users));
  }
  afterAll(async () => {
    await clearAll();
    await pool.end();
  });
  beforeEach(async () => {
    await clearAll();
  });

  it('pull window + tombstone delivery', async () => {
    const r1 = assetRecord();
    const r2 = assetRecord();
    const res = await push(db, USER_A, [mut(r1), mut(r2)]);
    expect(res.map((r) => r.status)).toEqual(['applied', 'applied']);

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id).sort()).toEqual([r1.id, r2.id].sort());
    expect(page.hasMore).toBe(false);

    // nothing new after the cursor
    const empty = await pull(db, USER_A, { cursor: page.cursor });
    expect(empty.changes.assets.records).toHaveLength(0);

    // delete r1 (tombstone) → flows through pull with deletedAt set
    await push(db, USER_A, [mut({ ...r1, updatedAt: 2000, deletedAt: 2000 })]);
    const afterDelete = await pull(db, USER_A, { cursor: page.cursor });
    expect(afterDelete.changes.assets.records).toHaveLength(1);
    expect(afterDelete.changes.assets.records[0]).toMatchObject({ id: r1.id, deletedAt: 2000 });
  });

  it('album_assets: a concurrent add and reorder both survive (no membership loss)', async () => {
    const albumId = randomUUID();
    const [a1, a2, a3, a4] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const edge = (assetId: string, position: string, over: Record<string, unknown> = {}) => ({
      collection: 'album_assets',
      record: { id: randomUUID(), createdAt: 1000, updatedAt: 1000, deletedAt: null, albumId, assetId, position, ...over },
    });

    // Initial membership [a1, a2, a3].
    const e1 = edge(a1, 'a');
    const e2 = edge(a2, 'b');
    const e3 = edge(a3, 'c');
    await push(db, USER_A, [e1, e2, e3]);

    // Device A adds a4 (new edge row). Device B reorders a3 to the front (updates only e3.position).
    // These touch DIFFERENT rows, so whole-record LWW can't clobber either.
    const e4 = edge(a4, keyBetween('c', null), { updatedAt: 1100 });
    await push(db, USER_A, [e4]);
    await push(db, USER_A, [{ ...e3, record: { ...e3.record, position: keyBetween(null, 'a'), updatedAt: 1200 } }]);

    const page = await pull(db, USER_A, { cursor: 0 });
    const edges = page.changes.album_assets.records as any[];
    const byAsset = Object.fromEntries(edges.map((e) => [e.assetId, e]));
    expect(edges).toHaveLength(4); // a4 add survived
    expect(byAsset[a4]).toBeTruthy();
    // a3 moved to the front (its new position sorts before a1's).
    expect(byAsset[a3].position < byAsset[a1].position).toBe(true);
    const order = edges.sort((x, y) => (x.position < y.position ? -1 : 1)).map((e) => e.assetId);
    expect(order).toEqual([a3, a1, a2, a4]);
  });

  it('LWW: newer wins, older is skipped with the winning current', async () => {
    const r = assetRecord({ updatedAt: 2000, notes: 'new' });
    expect((await push(db, USER_A, [mut(r)]))[0].status).toBe('applied');

    const older = await push(db, USER_A, [mut({ ...r, updatedAt: 1500, notes: 'old' })]);
    expect(older[0].status).toBe('skipped-lww');
    expect(older[0].current).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'new' });

    const newer = await push(db, USER_A, [mut({ ...r, updatedAt: 3000, notes: 'newest' })]);
    expect(newer[0].status).toBe('applied');
  });

  it('idempotent strict-> replay: equal timestamp is a no-op, no server_seq re-stamp', async () => {
    const r = assetRecord({ updatedAt: 1000 });
    await push(db, USER_A, [mut(r)]);
    const seq1 = await serverSeqOf(USER_A, r.id);

    const replay = await push(db, USER_A, [mut(r)]); // identical, equal updatedAt
    expect(replay[0].status).toBe('skipped-lww');
    const seq2 = await serverSeqOf(USER_A, r.id);
    expect(seq2).toBe(seq1); // NOT re-stamped → no sync amplification
  });

  it('multiple mutations for the same row in one push resolve by LWW in order', async () => {
    const r = assetRecord();
    const res = await push(db, USER_A, [
      mut({ ...r, updatedAt: 1000 }),
      mut({ ...r, updatedAt: 2000, notes: 'win' }),
      mut({ ...r, updatedAt: 1500, notes: 'lose' }),
    ]);
    expect(res.map((x) => x.status)).toEqual(['applied', 'applied', 'skipped-lww']);
    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records[0]).toMatchObject({ id: r.id, updatedAt: 2000, notes: 'win' });
  });

  it('concurrent pushes do not drop rows (per-user advisory lock serializes)', async () => {
    const records = Array.from({ length: 8 }, () => assetRecord());
    await Promise.all(records.map((r) => push(db, USER_A, [mut(r)])));
    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records).toHaveLength(8);
    expect(new Set(page.changes.assets.records.map((r: any) => r.id))).toEqual(new Set(records.map((r) => r.id)));
  });

  it('partial-push rejection: invalid record rejected, valid one persists', async () => {
    const good = assetRecord();
    const bad = { ...assetRecord(), mediaType: 'gif' }; // not in enum
    const res = await push(db, USER_A, [mut(good), mut(bad)]);
    expect(res[0].status).toBe('applied');
    expect(res[1].status).toBe('rejected');
    expect(res[1].reason).toContain('schema:');

    const page = await pull(db, USER_A, { cursor: 0 });
    expect(page.changes.assets.records.map((r: any) => r.id)).toEqual([good.id]);
  });

  it('pagination: hasMore loops until drained', async () => {
    const records = Array.from({ length: 5 }, () => assetRecord());
    await push(db, USER_A, records.map(mut));

    const seen: string[] = [];
    let cursor = 0;
    for (let i = 0; i < 10; i++) {
      const page = await pull(db, USER_A, { cursor, limit: 2 });
      seen.push(...page.changes.assets.records.map((r: any) => r.id));
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(new Set(seen)).toEqual(new Set(records.map((r) => r.id)));
  });

  describe('tenant isolation', () => {
    it('user B never sees user A rows; a colliding id lands in B partition, A untouched', async () => {
      const shared = assetRecord({ notes: 'A-data', updatedAt: 5000 });
      await push(db, USER_A, [mut(shared)]);

      // B does not see A's row
      const bEmpty = await pull(db, USER_B, { cursor: 0 });
      expect(bEmpty.changes.assets.records).toHaveLength(0);

      // B pushes a record with the SAME id → creates in B's own partition (composite PK)
      const bRes = await push(db, USER_B, [mut({ ...shared, notes: 'B-data', updatedAt: 9999 })]);
      expect(bRes[0].status).toBe('applied');

      // A's row is untouched; B has its own
      const aPage = await pull(db, USER_A, { cursor: 0 });
      expect(aPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'A-data', updatedAt: 5000 });
      const bPage = await pull(db, USER_B, { cursor: 0 });
      expect(bPage.changes.assets.records[0]).toMatchObject({ id: shared.id, notes: 'B-data', updatedAt: 9999 });
    });
  });

  // The "add a collection" recipe's silent failure modes (sync-design §9): a forgotten
  // server_seq trigger (rows never pulled) and a plain-id PK (cross-tenant collision). Assert
  // both — plus a round-trip and tenant isolation — for EVERY registered collection.
  describe('collection registry guard', () => {
    const base = () => ({ id: randomUUID(), createdAt: 1000, updatedAt: 1000, deletedAt: null });
    const sample: Record<string, () => Record<string, unknown>> = {
      assets: () => assetRecord(),
      albums: () => ({
        ...base(),
        name: 'A',
        isFavorite: false,
        archivedAt: null,
        showInPostSuggestionsAfter: null,
        oldCollectionName: null,
        notes: null,
        sortOrder: null,
        smartAlbumType: null,
      }),
      posts: () => ({
        ...base(),
        text: 'hi',
        isFavorite: false,
        postedAt: null,
        rePostId: null,
        isIgnoredForRepost: false,
        suggestRepostAt: 1000,
        hasBeenReposted: false,
      }),
      album_assets: () => ({ ...base(), albumId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
      post_assets: () => ({ ...base(), postId: randomUUID(), assetId: randomUUID(), position: 'a0' }),
    };

    for (const name of collectionNames) {
      it(`${name}: registered, trigger + composite PK, round-trips, tenant-isolated`, async () => {
        expect(serverCollections[name]).toBeTruthy();

        const trig = await pool.query('SELECT 1 FROM pg_trigger WHERE tgname = $1', [`${name}_server_seq`]);
        expect(trig.rowCount).toBe(1);

        const pk = await pool.query(
          `SELECT a.attname FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = $1::regclass AND i.indisprimary`,
          [name],
        );
        expect(pk.rows.map((r: { attname: string }) => r.attname).sort()).toEqual(['id', 'user_id']);

        const rec = sample[name]();
        const res = await push(db, USER_A, [{ collection: name, record: rec }]);
        expect(res[0].status).toBe('applied');

        const aPage = await pull(db, USER_A, { cursor: 0 });
        expect(aPage.changes[name].records.some((r: any) => r.id === rec.id)).toBe(true);

        const bPage = await pull(db, USER_B, { cursor: 0 });
        expect(bPage.changes[name]?.records.some((r: any) => r.id === rec.id) ?? false).toBe(false);
      });
    }
  });
});
