import { collectionsByName, type AssetRecord, type PushMutation } from '@squidbox/shared';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import * as serverSchema from '../../server/src/db/schema.js';
import { serverCollections } from '../../server/src/sync/collections.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import * as repo from '../src/sync/assetsRepository';
import { createDb, type Execute } from '../src/sync/db/driver';
import journal from '../src/sync/db/migrations/meta/_journal.json';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { retryFailures } from '../src/sync/outbox';
import { setOwner } from '../src/sync/status';
import type { RemoveFiles } from '../src/sync/sweepPurgedFiles';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

// The installed app is the client code of INSTALLED, the commit of the preview build on the owner's
// phone, run as it is against this server. The suite extracts its apps/mobile/src/sync into
// test/.main-client (gitignored) and drives it with its own SQLite migrations; an "update" then runs
// this branch's new migrations on that same database and goes on with this branch's code. Needs the
// docker Postgres and that commit in git (CI checks out the whole history): in CI a missing one fails
// the suite instead of skipping it.
const INSTALLED = 'df33378';
const TEST_URL = process.env.TEST_DATABASE_URL;
const here = fileURLToPath(new URL('.', import.meta.url));
const mainRoot = `${here}.main-client`;
const hasInstalled = (() => {
  try {
    execFileSync('git', ['cat-file', '-e', `${INSTALLED}^{commit}`], { cwd: here, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (TEST_URL && !hasInstalled && process.env.CI)
  throw new Error(`mainClient.e2e: commit ${INSTALLED} (the installed app) is missing; fetch the full history`);
const d = TEST_URL && hasInstalled ? describe : describe.skip;

const USER = randomUUID();
const S = 1_800_000_000_000;

function extractMain() {
  rmSync(mainRoot, { recursive: true, force: true });
  mkdirSync(mainRoot, { recursive: true });
  const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here }).toString().trim();
  const archive = execFileSync('git', ['archive', INSTALLED, 'apps/mobile/src/sync'], {
    cwd: top,
    maxBuffer: 1 << 28,
  });
  execFileSync('tar', ['-x', '-C', mainRoot, '--strip-components=3'], { input: archive });
  if (!existsSync(`${mainRoot}/sync/worker.ts`)) throw new Error(`${INSTALLED} has no apps/mobile/src/sync/worker.ts`);
}

function executor(sqlite: Database.Database): Execute {
  return async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') return { rows: [], changes: statement.run(...params).changes };
    const rows = statement.raw().all(...params);
    return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
  };
}

function runMigrations(sqlite: Database.Database, folder: string, from = 0) {
  for (const migration of readMigrationFiles({ migrationsFolder: folder }).slice(from))
    for (const statement of migration.sql) sqlite.exec(statement);
}

const newMigrations = fileURLToPath(new URL('../src/sync/db/migrations', import.meta.url));
const firstNew = journal.entries.findIndex((entry) => entry.tag === '0011_outbox_fields');

/* eslint-disable @typescript-eslint/no-explicit-any -- the installed app's modules, loaded at runtime */
let main: {
  worker: any;
  assets: any;
  driver: any;
  schema: any;
};

interface Phone {
  sqlite: Database.Database;
  db: SyncDb;
  /** Still the installed app (its code); false once updated. */
  old: boolean;
  removed: string[];
}

d('the installed app (its client code, as built) against this server', () => {
  let pool: pg.Pool;
  let pgDb: ReturnType<typeof pgDrizzle>;
  let pushes: { phone: Phone; mutations: PushMutation[] }[];

  const at = (t: number) => vi.setSystemTime(t);
  const transport: SyncTransport = {
    push: async (req) => ({ results: await serverPush(pgDb as any, USER, req.mutations) }),
    pull: (req) => serverPull(pgDb as any, USER, { cursor: req.cursor, limit: req.limit }),
  };
  const removeFilesOf =
    (phone: Phone): RemoveFiles =>
    async (files) => {
      for (const file of files)
        for (const name of [file.filename, file.thumbnailFilename]) if (name) phone.removed.push(name);
    };

  function installedPhone(): Phone {
    const sqlite = new Database(':memory:');
    runMigrations(sqlite, `${mainRoot}/sync/db/migrations`);
    return { sqlite, db: main.driver.createDb(executor(sqlite)), old: true, removed: [] };
  }
  function newPhone(): Phone {
    const sqlite = new Database(':memory:');
    runMigrations(sqlite, newMigrations);
    return { sqlite, db: createDb(executor(sqlite)), old: false, removed: [] };
  }
  // The app update: this branch's migrations on the installed app's database, then this branch's code,
  // opened as library/current.ts opens it (failed pushes retried, the owner kept).
  async function update(phone: Phone) {
    runMigrations(phone.sqlite, newMigrations, firstNew);
    phone.db = createDb(executor(phone.sqlite));
    phone.old = false;
    await setOwner(phone.db, { kind: 'account', serverId: 's', userId: USER, email: '' } as any);
    await retryFailures(phone.db);
  }
  async function sync(phone: Phone, now = S + 100_000) {
    at(now);
    const logged: SyncTransport = {
      push: async (req) => {
        pushes.push({ phone, mutations: req.mutations });
        return transport.push(req);
      },
      pull: transport.pull,
    };
    if (phone.old) await main.worker.runSyncOnce(phone.db, logged, { removeFiles: removeFilesOf(phone) });
    else await runSyncOnce(phone.db, logged, { removeFiles: removeFilesOf(phone) });
  }
  const assetsOf = (phone: Phone) => (phone.old ? main.assets : repo);
  async function edit(phone: Phone, t: number, write: (assets: any) => Promise<unknown>) {
    at(t);
    await write(assetsOf(phone));
  }
  async function purge(phone: Phone, t: number, id: string) {
    at(t);
    if (phone.old) await main.assets.purgeAssets(phone.db, [id], removeFilesOf(phone));
    else await repo.purgeAssets(phone.db, [id]);
  }

  const syncedKeys = Object.keys((collectionsByName.assets!.schema as unknown as { shape: object }).shape);
  const synced = (row: Record<string, unknown> | undefined) =>
    row && Object.fromEntries(syncedKeys.map((key) => [key, row[key] ?? null]));
  async function serverAsset(id: string) {
    const { table, wireColumns } = serverCollections.assets!;
    const [row] = await pgDb
      .select(wireColumns)
      .from(table)
      .where(and(eq((table as any).userId, USER), eq((table as any).id, id)));
    return row as Record<string, any> | undefined;
  }
  async function localAsset(phone: Phone, id: string) {
    const table = phone.old ? main.schema.assets : clientSchema.assets;
    const [row] = await phone.db.select().from(table).where(eq(table.id, id));
    return row as Record<string, any> | undefined;
  }
  async function outboxOf(phone: Phone) {
    return phone.db.select().from(phone.old ? main.schema.outbox : clientSchema.outbox);
  }
  async function settle(phones: Phone[]) {
    for (let round = 0; round < 3; round++) for (const phone of phones) await sync(phone);
  }
  async function expectConverged(id: string, phones: Phone[]) {
    const server = synced(await serverAsset(id));
    for (const phone of phones) {
      expect(synced(await localAsset(phone, id)), phone.old ? 'installed app' : 'new app').toEqual(server);
      expect(await outboxOf(phone)).toEqual([]);
    }
    return server!;
  }
  async function seed(phones: Phone[], over: Partial<AssetRecord> = {}) {
    at(S);
    const [first] = phones;
    const record = await assetsOf(first!).createAsset(
      first!.db,
      makeAssetRecord({ createdAt: S, updatedAt: S, purgedAt: null, ...over } as Partial<AssetRecord>),
    );
    await settle(phones);
    return record.id as string;
  }

  beforeAll(async () => {
    extractMain();
    main = {
      worker: await import(/* @vite-ignore */ `${mainRoot}/sync/worker.ts`),
      assets: await import(/* @vite-ignore */ `${mainRoot}/sync/assetsRepository.ts`),
      driver: await import(/* @vite-ignore */ `${mainRoot}/sync/db/driver.ts`),
      schema: await import(/* @vite-ignore */ `${mainRoot}/sync/db/schema.ts`),
    };
    pool = new pg.Pool({ connectionString: TEST_URL });
    pgDb = pgDrizzle(pool, { schema: serverSchema });
    await pgDb
      .insert(serverSchema.users)
      .values({ id: USER, email: `mainclient-${USER}@test.local`, passwordDigest: 'x', storageBucket: null });
  });
  afterAll(async () => {
    await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
    await pgDb.delete(serverSchema.users).where(eq(serverSchema.users.id, USER));
    await pool.end();
  });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
    pushes = [];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pushes whole records without fields, and both apps converge on edits of different fields', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N]);
    await edit(M, S + 100, (a) => a.updateAsset(M.db, id, { notes: 'from the installed app' }));
    await edit(N, S + 200, (a) => a.toggleFavorite(N.db, id));
    await sync(N);
    await sync(M);
    expect(
      pushes.filter(({ phone }) => phone === M).every(({ mutations }) => mutations.every((m) => !('fields' in m))),
    ).toBe(true);
    await settle([M, N]);
    // The installed app's stale isFavorite (false at S+100) loses to the newer favorite, its notes win.
    expect(await expectConverged(id, [M, N])).toMatchObject({ notes: 'from the installed app', isFavorite: true });
  });

  it('the installed app’s purge (files gone at once) against a newer restore on the new app: the restore wins everywhere', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N], { deletedAt: S });
    await purge(M, S + 100, id);
    expect(M.removed).toEqual(['a.jpg', 't.jpg']);
    await edit(N, S + 200, (a) => a.updateAsset(N.db, id, { deletedAt: null }));
    await sync(N);
    await sync(M);
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(N.removed).toEqual([]);
  });

  it('a new app’s purge reaches the installed app, which removes its files once', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N]);
    await edit(N, S + 100, (a) => a.deleteAssets(N.db, [id]));
    await purge(N, S + 200, id);
    await settle([N, M]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ purgedAt: S + 200 });
    expect(M.removed).toEqual(['a.jpg', 't.jpg']);
    expect(N.removed).toEqual(['a.jpg', 't.jpg']);
  });

  it('a new app’s offline purge loses to a newer restore the installed app made: files stay on the new app', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N], { deletedAt: S });
    await purge(N, S + 100, id);
    await edit(M, S + 200, (a) => a.updateAsset(M.db, id, { deletedAt: null }));
    await sync(M);
    await sync(N);
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(N.removed).toEqual([]);
  });

  // The upgrade path: the installed app's database with a mixed outbox, updated in place.
  it('an update with a mixed outbox: each row pushes whole, a failed one is retried, the purges keep their files rule', async () => {
    const M = installedPhone();
    const N = newPhone();
    const edited = await seed([M, N]);
    const failed = await seed([M, N]);
    const purgedHere = await seed([M, N], { deletedAt: S, filename: 'p.jpg', thumbnailFilename: 'pt.jpg' });
    const confirmed = await seed([M, N], { deletedAt: S, filename: 'c.jpg', thumbnailFilename: 'ct.jpg' });
    const fresh = makeAssetRecord({
      createdAt: S + 50,
      updatedAt: S + 50,
      filename: 'n.jpg',
      thumbnailFilename: 'nt.jpg',
      purgedAt: null,
    } as Partial<AssetRecord>);

    // On the installed app: a purge the server confirms, then offline a notes edit, an edit the server
    // rejected (its row keeps an error), a purge (files gone at once) and a new photo.
    await purge(M, S + 60, confirmed);
    await sync(M);
    await edit(M, S + 100, (a) => a.updateAsset(M.db, edited, { notes: 'M' }));
    await edit(M, S + 110, (a) => a.updateAsset(M.db, failed, { notes: 'rejected once' }));
    M.sqlite.prepare(`UPDATE outbox SET error = 'schema:notes' WHERE record_id = ?`).run(failed);
    await purge(M, S + 120, purgedHere);
    await edit(M, S + 130, (a) => a.createAsset(M.db, fresh));
    expect(M.removed).toEqual(['c.jpg', 'ct.jpg', 'p.jpg', 'pt.jpg']);
    // Meanwhile on the new app: a newer favorite of the edited photo and a newer restore of the purged one.
    await edit(N, S + 200, (a) => a.toggleFavorite(N.db, edited));
    await edit(N, S + 210, (a) => a.updateAsset(N.db, purgedHere, { deletedAt: null }));
    await sync(N);

    await update(M);
    const rows = M.sqlite
      .prepare('SELECT record_id, whole_record, error, fields FROM outbox ORDER BY id')
      .all() as any[];
    expect(rows.map((row) => [row.record_id, row.whole_record, row.error])).toEqual([
      [edited, 1, null],
      [failed, 1, null],
      [purgedHere, 1, null],
      [fresh.id, 1, null],
    ]);
    for (const row of rows) expect(Object.keys(JSON.parse(row.fields))).toContain('notes');
    const removedFor = (id: string) =>
      (
        M.sqlite.prepare('SELECT files_removed_for AS purge FROM assets WHERE id = ?').get(id) as {
          purge: number | null;
        }
      ).purge;
    // The installed app recorded no removals (it removed a purge's files at once, but not those of a
    // purge learned in a full resync): the first sweep after the update goes over every purge once.
    expect(removedFor(purgedHere)).toBeNull();
    expect(removedFor(confirmed)).toBeNull();

    // A pull before the push (its push refused): the whole rows keep every field of their payload.
    at(S + 300);
    await runSyncOnce(M.db, {
      push: async (req) => ({
        results: req.mutations.map((m) => ({
          id: String(m.record.id),
          collection: m.collection,
          status: 'rejected' as const,
          reason: 'offline',
        })),
      }),
      pull: transport.pull,
    });
    expect(await localAsset(M, edited)).toMatchObject({ notes: 'M', isFavorite: false });
    expect(await localAsset(M, purgedHere)).toMatchObject({ purgedAt: S + 120 });
    await retryFailures(M.db);

    M.removed = [];
    await settle([M, N]);
    for (const id of [edited, failed, purgedHere, confirmed, fresh.id]) await expectConverged(id, [M, N]);
    expect(await serverAsset(edited)).toMatchObject({ notes: 'M', isFavorite: true });
    expect(await serverAsset(failed)).toMatchObject({ notes: 'rejected once' });
    // The installed app's whole-record purge is older than the restore: it loses, the photo is back
    // (without its files on M, which the installed app removed at once, as it always did).
    expect(await serverAsset(purgedHere)).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(removedFor(purgedHere)).toBeNull();
    expect(M.removed).toEqual(['c.jpg', 'ct.jpg']); // the confirmed purge's, once more; nothing of a live photo
    M.removed = [];

    // Purged again on the new app: the updated app removes the copies made since, once.
    await edit(N, S + 400, (a) => a.deleteAssets(N.db, [purgedHere]));
    await purge(N, S + 410, purgedHere);
    await settle([N, M]);
    await settle([M, N]);
    expect(M.removed).toEqual(['p.jpg', 'pt.jpg']);
    expect(N.removed).toEqual(['c.jpg', 'ct.jpg', 'p.jpg', 'pt.jpg']); // the installed app's confirmed purge too, once
  });

  it('an update with a pending whole row, then a new edit coalesced into it: still pushed whole, converges', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N]);
    await edit(M, S + 100, (a) => a.updateAsset(M.db, id, { notes: 'before the update' }));
    await edit(N, S + 200, (a) => a.toggleFavorite(N.db, id));
    await sync(N);
    await update(M);
    pushes = [];
    // Coalesced into the whole row, which still names every field: pushed whole at S+150, older than
    // the favorite, so the favorite stays (and M adopts it).
    await edit(M, S + 150, (a) => a.updateAsset(M.db, id, { notes: 'after' }));
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ notes: 'after', isFavorite: true });
    const fromM = pushes.filter(({ phone }) => phone === M).flatMap(({ mutations }) => mutations);
    expect(fromM.map((m) => 'fields' in m)).toEqual([false]);
    // The next edit after it settled is per-field.
    await edit(M, S + 300, (a) => a.updateAsset(M.db, id, { notes: 'per field' }));
    await sync(M);
    expect(pushes.at(-1)!.mutations.map((m) => m.fields)).toEqual([{ notes: S + 300 }]);
  });

  // The installed app edits a photo while its clock is behind, during a sync run, after its push and
  // before its pull (its pull then skips the record, and moves its cursor past the newer row). A
  // whole record from an older app at a newer clock had set every field of the row with the same
  // values. The installed app's next push loses every field on its clock but holds the same values:
  // the server answers skipped-lww with the row (its updatedAt is newer), as the installed build's server did, and
  // the installed app adopts it.
  it('an installed app whose whole record loses every clock but no value converges on updatedAt', async () => {
    const M = installedPhone();
    const other = installedPhone(); // another installed app, or the legacy importer: whole records
    const id = await seed([M, other]);
    // The other app writes the same notes at S+500, a whole record: every field's clock is S+500.
    await edit(other, S + 500, (a) => a.updateAsset(other.db, id, { notes: 'same' }));
    await sync(other, S + 500);
    // M's clock is behind: during its sync run, between push and pull, it writes notes 'same' at S+300.
    at(S + 300);
    await main.worker.runSyncOnce(M.db, {
      push: transport.push,
      pull: async (req: any) => {
        await main.assets.updateAsset(M.db, id, { notes: 'same' });
        return transport.pull(req);
      },
    });
    await settle([M, other]);
    await expectConverged(id, [M, other]);
  });

  // The upgrade with purges the installed app already made, one of a photo sharing its file with a
  // live one (the installed app kept that name): the first sweep goes over them once, and the shared
  // name goes when its last user is purged after the update; purge, restore and purge again after the
  // update sweep the copies once per purge that the server kept.
  it('an update after purges sharing a name with a live photo: each name goes once, when its last user is purged', async () => {
    const M = installedPhone();
    const N = newPhone();
    const a = await seed([M, N], { deletedAt: S, filename: 's.jpg', thumbnailFilename: 'at.jpg' });
    const b = await seed([M, N], { filename: 's.jpg', thumbnailFilename: 'bt.jpg' });
    const c = await seed([M, N], { deletedAt: S, filename: 'c.jpg', thumbnailFilename: 'ct.jpg' });
    await purge(M, S + 100, a);
    await sync(M, S + 150);
    expect(M.removed).toEqual(['at.jpg']); // s.jpg: b's
    await update(M);
    M.removed = [];
    await settle([M, N]);
    // The first sweep after the update goes over every purge once (the installed app never recorded
    // which it removed): at.jpg again, harmless; s.jpg stays b's.
    expect(M.removed).toEqual(['at.jpg']);
    M.removed = [];

    // c: purged on M (now updated), restored on N before M's push, then purged again on N.
    await purge(M, S + 200, c);
    await edit(N, S + 300, (x) => x.updateAsset(N.db, c, { deletedAt: null }));
    await sync(N, S + 310);
    await sync(M, S + 320);
    expect(M.removed).toEqual([]);
    expect(await serverAsset(c)).toMatchObject({ deletedAt: null, purgedAt: null });
    await edit(N, S + 400, (x) => x.deleteAssets(N.db, [c]));
    await purge(N, S + 410, c);
    await settle([N, M]);
    expect(M.removed).toEqual(['c.jpg', 'ct.jpg']);

    // b, the last user of s.jpg, purged on N: the updated app removes s.jpg once.
    await edit(N, S + 500, (x) => x.deleteAssets(N.db, [b]));
    await purge(N, S + 510, b);
    await settle([N, M]);
    await settle([M, N]);
    expect(M.removed.sort()).toEqual(['bt.jpg', 'c.jpg', 'ct.jpg', 's.jpg']);
    for (const id of [a, b, c]) await expectConverged(id, [M, N]);
  });

  // Long seeded runs of two installed apps and a new one on a few photos, with
  // clocks ahead and behind, edits made during a push or between a push and its pull (its pull then
  // skips the record), purges from the Deleted album, and the installed apps updating mid-run. After
  // every run all phones and the server hold the same rows and every outbox is empty; a purge the
  // server took stays; the new app removes only the files of purges the server kept. RUNS_FROM, RUNS_TO,
  // RUNS_STEPS and RUNS_SKEWS (ms per phone, comma-separated) widen a run by hand.
  it('seeded runs of installed and new apps, with updates mid-run, converge every time', async () => {
    const SKEWS = process.env.RUNS_SKEWS ? process.env.RUNS_SKEWS.split(',').map(Number) : [0, -700, 900];
    for (let n = Number(process.env.RUNS_FROM ?? 1); n <= Number(process.env.RUNS_TO ?? 24); n++) {
      let state = n * 7919;
      const rand = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
      await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
      const phones = [installedPhone(), installedPhone(), newPhone()];
      const skew = new Map(phones.map((phone, i) => [phone, SKEWS[i]!]));
      const ids: string[] = [];
      for (let i = 0; i < 3; i++)
        ids.push(
          await seed(phones, { filename: `f${i}.jpg`, thumbnailFilename: `t${i}.jpg`, deletedAt: i === 0 ? S : null }),
        );
      let t = S + 1000;
      const purgedOnServer = new Map<string, number>();
      const trail: string[] = [];
      const write = async (phone: Phone, id: string) => {
        const row = await localAsset(phone, id);
        if (!row || row.purgedAt !== null) return;
        const a = assetsOf(phone);
        const action = pick(['notes', 'favorite', 'delete', 'restore', 'purge', 'purge'] as const);
        const skipped = (action === 'restore' || action === 'purge') && row.deletedAt === null;
        trail.push(
          `${phones.indexOf(phone)}${phone.old ? 'o' : 'n'} ${action}${skipped ? ' (not deleted: none)' : ''} ${ids.indexOf(id)} @${Date.now()}`,
        );
        if (action === 'notes') await a.updateAsset(phone.db, id, { notes: `n${t}` });
        else if (action === 'favorite') await a.toggleFavorite(phone.db, id);
        else if (action === 'delete') await a.deleteAssets(phone.db, [id]);
        else if (action === 'restore' && row.deletedAt !== null) await a.updateAsset(phone.db, id, { deletedAt: null });
        else if (action === 'purge' && row.deletedAt !== null) {
          if (phone.old) await main.assets.purgeAssets(phone.db, [id], removeFilesOf(phone));
          else await repo.purgeAssets(phone.db, [id]);
        }
      };
      for (let step = 0; step < Number(process.env.RUNS_STEPS ?? 40); step++) {
        t += 10 + Math.floor(rand() * 200);
        const phone = pick(phones);
        const now = t + skew.get(phone)!;
        const kind = pick(['edit', 'edit', 'sync', 'sync', 'editInPull', 'editInPush', 'update'] as const);
        if (kind === 'update') {
          if (phone.old) {
            trail.push(`${phones.indexOf(phone)} update`);
            await update(phone);
            phone.removed = []; // the installed app removed its purges' files at once, as it always did
          }
          continue;
        }
        if (kind === 'edit') {
          at(now);
          await write(phone, pick(ids));
          continue;
        }
        const id = pick(ids);
        let done = false;
        const once = async () => {
          if (done) return;
          done = true;
          at(now + 1);
          await write(phone, id);
        };
        const run: SyncTransport = {
          push: async (req) => {
            pushes.push({ phone, mutations: req.mutations });
            const result = await transport.push(req);
            for (const [i, r] of result.results.entries())
              trail.push(
                `  push ${ids.indexOf(r.id)} ${JSON.stringify(req.mutations[i]!.fields ?? 'whole')} del=${(req.mutations[i]!.record as any).deletedAt} purge=${(req.mutations[i]!.record as any).purgedAt} → ${r.status}${r.current ? ` del=${(r.current as any).deletedAt} purge=${(r.current as any).purgedAt}` : ''}`,
              );
            if (kind === 'editInPush') await once();
            return result;
          },
          pull: async (req) => {
            if (kind === 'editInPull') await once();
            return transport.pull(req);
          },
        };
        trail.push(`${phones.indexOf(phone)} ${kind} @${now}`);
        at(now);
        // The server's clock is the true time: a phone ahead is clamped.
        const serverNow = t;
        const timed: SyncTransport = {
          push: async (req) => {
            at(serverNow);
            try {
              return await run.push(req);
            } finally {
              at(now);
            }
          },
          pull: run.pull,
        };
        const before = phone.removed.length;
        if (phone.old) await main.worker.runSyncOnce(phone.db, timed, { removeFiles: removeFilesOf(phone) });
        else await runSyncOnce(phone.db, timed, { removeFiles: removeFilesOf(phone) });
        if (phone.removed.length > before) trail.push(`  removed ${phone.removed.slice(before).join(',')}`);
        for (const id of ids) {
          const row = await serverAsset(id);
          if (row?.purgedAt) {
            const was = purgedOnServer.get(id);
            if (was !== undefined) expect(row.purgedAt, `seed ${n}: a purge stays\n${trail.join('\n')}`).toBe(was);
            purgedOnServer.set(id, row.purgedAt);
          } else expect(purgedOnServer.has(id), `seed ${n}: un-purged\n${trail.join('\n')}`).toBe(false);
        }
      }
      t += 10_000;
      for (let round = 0; round < 3; round++) for (const phone of phones) await sync(phone, t);
      for (const id of ids) {
        const server = synced(await serverAsset(id));
        if (server?.purgedAt) purgedOnServer.set(id, server.purgedAt as number);
        for (const phone of phones) {
          expect(
            synced(await localAsset(phone, id)),
            `seed ${n}, phone ${phones.indexOf(phone)}, photo ${ids.indexOf(id)}\n${trail.join('\n')}`,
          ).toEqual(server);
          expect(await outboxOf(phone), `seed ${n}`).toEqual([]);
        }
      }
      const newPhones = phones.filter((phone) => !phone.old);
      for (const phone of newPhones)
        for (const name of phone.removed) {
          const i = Number(name.slice(1, 2));
          expect(
            purgedOnServer.has(ids[i]!),
            `seed ${n}: ${name} removed on new app ${phones.indexOf(phone)}\n${trail.join('\n')}`,
          ).toBe(true);
        }
    }
  }, 240_000);
});
