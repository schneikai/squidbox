import { collectionsByName, type AssetRecord } from '@squidbox/shared';
import { fakeClock } from '@squidbox/shared/testing/fakeClock';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import * as serverSchema from '../../server/src/db/schema.js';
import { serverCollections } from '../../server/src/sync/collections.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import * as repo from '../src/sync/assetsRepository';
import { createDb, type Execute } from '../src/sync/db/driver';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { retryFailures } from '../src/sync/outbox';
import { setOwner } from '../src/sync/status';
import type { RemoveFiles } from '../src/sync/sweepPurgedFiles';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

// The installed app is the client code of INSTALLED, the commit installed on the owner's
// phone, run as it is against this server. The suite extracts its apps/mobile/src/sync into
// test/.main-client (gitignored) and drives it with its own SQLite migrations; an "update" then runs
// the current migrations on that same database and goes on with the current code. Needs the
// docker Postgres and that commit, which the suite fetches (depth 1) when the checkout lacks it: in CI
// one it can't get fails the suite instead of skipping it.
const INSTALLED = 'b8171cf94f0e681b1b1e1489755730698a95789c';
const TEST_URL = process.env.TEST_DATABASE_URL;
const here = fileURLToPath(new URL('.', import.meta.url));
const mainRoot = `${here}.main-client`;
// git's output, run in this checkout (or `cwd`), and whether a git command succeeds.
const git = (args: string[], cwd = here) =>
  execFileSync('git', args, { cwd, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
function gitOk(args: string[]): boolean {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}
const hasInstalled =
  Boolean(TEST_URL) &&
  (gitOk(['cat-file', '-e', `${INSTALLED}^{commit}`]) || gitOk(['fetch', '--depth=1', 'origin', INSTALLED]));
if (TEST_URL && !hasInstalled && process.env.CI)
  throw new Error(`mainClient.e2e: commit ${INSTALLED} (the installed app) could not be fetched from origin`);
const d = hasInstalled ? describe : describe.skip;

const USER = randomUUID();
const S = 1_800_000_000_000;

function extractMain() {
  rmSync(mainRoot, { recursive: true, force: true });
  mkdirSync(mainRoot, { recursive: true });
  const top = git(['rev-parse', '--show-toplevel']).toString().trim();
  const archive = git(['archive', INSTALLED, 'apps/mobile/src/sync'], top);
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
const installedMigrations = `${mainRoot}/sync/db/migrations`;

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
  let firstNew: number; // the first migration the installed app lacks

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
    runMigrations(sqlite, installedMigrations);
    return { sqlite, db: main.driver.createDb(executor(sqlite)), old: true, removed: [] };
  }
  function newPhone(): Phone {
    const sqlite = new Database(':memory:');
    runMigrations(sqlite, newMigrations);
    return { sqlite, db: createDb(executor(sqlite)), old: false, removed: [] };
  }
  // The app update: the current migrations on the installed app's database, then the current code,
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
    if (phone.old) await main.worker.runSyncOnce(phone.db, transport, { removeFiles: removeFilesOf(phone) });
    else await runSyncOnce(phone.db, transport, { removeFiles: removeFilesOf(phone) });
  }
  const assetsOf = (phone: Phone) => (phone.old ? main.assets : repo);
  async function edit(phone: Phone, t: number, write: (assets: any) => Promise<unknown>) {
    at(t);
    await write(assetsOf(phone));
  }
  async function purge(phone: Phone, t: number, id: string) {
    at(t);
    await assetsOf(phone).purgeAssets(phone.db, [id]);
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
    const record = await assetsOf(first!).create(
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
      assets: withVerbs(await import(/* @vite-ignore */ `${mainRoot}/sync/assetsRepository.ts`)),
      driver: await import(/* @vite-ignore */ `${mainRoot}/sync/db/driver.ts`),
      schema: await import(/* @vite-ignore */ `${mainRoot}/sync/db/schema.ts`),
    };
    // The update runs the migrations after the installed app's, which must be the first of the current ones.
    const hashes = (folder: string) => readMigrationFiles({ migrationsFolder: folder }).map(({ hash }) => hash);
    const installed = hashes(installedMigrations);
    expect(hashes(newMigrations).slice(0, installed.length)).toEqual(installed);
    firstNew = installed.length;
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
    fakeClock();
    await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
  });

  it('both apps converge on edits of different fields', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N]);
    await edit(M, S + 100, (a) => a.update(M.db, id, { notes: 'from the installed app' }));
    await edit(N, S + 200, (a) => a.toggleFavorite(N.db, id));
    await sync(N);
    await sync(M);
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ notes: 'from the installed app', isFavorite: true });
  });

  it('the installed app’s purge against a newer restore on the new app: the restore wins everywhere', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N], { deletedAt: S });
    await purge(M, S + 100, id);
    await edit(N, S + 200, (a) => a.update(N.db, id, { deletedAt: null }));
    await sync(N);
    await sync(M);
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(M.removed).toEqual([]);
    expect(N.removed).toEqual([]);
  });

  it('a new app’s purge reaches the installed app, which removes its files once', async () => {
    const M = installedPhone();
    const N = newPhone();
    const id = await seed([M, N]);
    await edit(N, S + 100, (a) => a.remove(N.db, [id]));
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
    await edit(M, S + 200, (a) => a.update(M.db, id, { deletedAt: null }));
    await sync(M);
    await sync(N);
    await settle([M, N]);
    expect(await expectConverged(id, [M, N])).toMatchObject({ deletedAt: null, purgedAt: null });
    expect(N.removed).toEqual([]);
  });

  // Long seeded runs of two installed apps and a new one on a few photos, with
  // clocks ahead and behind, edits made during a push or between a push and its pull (its pull then
  // skips the record), purges from the Deleted album, and the installed apps updating mid-run. After
  // every run all phones and the server hold the same rows and every outbox is empty; a purge the
  // server took stays; every app removes only the files of purges the server kept. RUNS_FROM,
  // RUNS_TO, RUNS_STEPS and RUNS_SKEWS (ms per phone, comma-separated) widen a run by hand.
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
        if (action === 'notes') await a.update(phone.db, id, { notes: `n${t}` });
        else if (action === 'favorite') await a.toggleFavorite(phone.db, id);
        else if (action === 'delete') await a.remove(phone.db, [id]);
        else if (action === 'restore' && row.deletedAt !== null) await a.update(phone.db, id, { deletedAt: null });
        else if (action === 'purge' && row.deletedAt !== null) await a.purgeAssets(phone.db, [id]);
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
      for (const phone of phones)
        for (const name of phone.removed) {
          const i = Number(name.slice(1, 2));
          expect(
            purgedOnServer.has(ids[i]!),
            `seed ${n}: ${name} removed on phone ${phones.indexOf(phone)}\n${trail.join('\n')}`,
          ).toBe(true);
        }
    }
  }, 240_000);
});

// INSTALLED predates the repositories' shared verbs and names them after the collection; delete this
// once INSTALLED is a commit with `create`, `update`, `remove` and the rest.
function withVerbs(assets: any) {
  return {
    ...assets,
    create: assets.create ?? assets.createAsset,
    createMany: assets.createMany ?? assets.createAssets,
    update: assets.update ?? assets.updateAsset,
    updateMany: assets.updateMany ?? assets.updateAssets,
    updateAll: assets.updateAll ?? assets.updateAllAssets,
    remove: assets.remove ?? assets.deleteAssets,
  };
}
