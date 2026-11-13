import { type AssetRecord } from '@squidbox/shared';
import { fakeClock } from '@squidbox/shared/testing/fakeClock';
import Database from 'better-sqlite3';
import { and, eq, is } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { fuzzRuns } from './helpers/fuzzRuns';
import { populateEveryTable } from './helpers/populateEveryTable';
import { betterSqliteExecutor, migrationsFolder, runMigrations } from './helpers/testDb';
import { at, removedFiles, S, synced as syncedFields } from './helpers/twoDeviceServer';
import { readSnapshots } from '../../server/src/contract/snapshots.js';
import type { Db } from '../../server/src/db/client.js';
import * as serverSchema from '../../server/src/db/schema.js';
import { serverCollections } from '../../server/src/sync/collections.js';
import { pull as serverPull } from '../../server/src/sync/pull.js';
import { push as serverPush } from '../../server/src/sync/push.js';
import * as repo from '../src/sync/assetsRepository';
import { createDb } from '../src/sync/db/driver';
import * as clientSchema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import { retryFailures } from '../src/sync/outbox';
import { setOwner } from '../src/sync/status';
import type { RemoveFiles } from '../src/sync/sweepPurgedFiles';
import type { SyncTransport } from '../src/sync/transport';
import { runSyncOnce } from '../src/sync/worker';

// The installed apps are the App builds, each recorded with its commit by a contract snapshot
// (apps/server/contract/builds, written by the ios-build skill for every App build): the suite runs
// the oldest and the newest, each build's client code as built against this server. It extracts the
// build's apps/mobile/src/sync into test/.builds/<name> (gitignored) and drives it with its own
// SQLite migrations; an "update" then runs the current migrations on that same database and goes on
// with the current code. The old sync code imports the build's own packages/shared (extracted beside
// it); its few `@/` imports (the API client, errors) still resolve to today's src
// (docs/sync-design.md §15). Needs Postgres and each build's commit, which the suite fetches
// (depth 1) when the checkout lacks it: in CI one it can't get fails the suite instead of skipping it.
const TEST_URL = process.env.TEST_DATABASE_URL;
const here = fileURLToPath(new URL('.', import.meta.url));
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

type Build = { name: string; sha: string };

// The oldest and the newest build (once when they are the same). A build retires by deleting its
// snapshot, once no device runs it.
function buildsUnderTest(): Build[] {
  const builds = readSnapshots().map(({ commit, builtAt }) => ({
    name: `${builtAt} (${commit.slice(0, 8)})`,
    sha: commit,
  }));
  return [...new Set([builds[0], builds.at(-1)])].filter((build): build is Build => build !== undefined);
}

const builds = TEST_URL ? buildsUnderTest() : [];
const missing = builds.filter(
  ({ sha }) => !gitOk(['cat-file', '-e', `${sha}^{commit}`]) && !gitOk(['fetch', '--depth=1', 'origin', sha]),
);
if (missing.length > 0 && process.env.CI)
  throw new Error(`installedBuilds.e2e: could not fetch ${missing.map(({ sha }) => sha).join(', ')} from origin`);

function extract({ sha }: Build): string {
  const root = `${here}.builds/${sha.slice(0, 8)}`;
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const top = git(['rev-parse', '--show-toplevel']).toString().trim();
  const archive = git(['archive', sha, 'apps/mobile/src/sync'], top);
  execFileSync('tar', ['-x', '-C', root, '--strip-components=3'], { input: archive });
  if (!existsSync(`${root}/sync/worker.ts`)) throw new Error(`${sha} has no apps/mobile/src/sync/worker.ts`);
  // The build's own @squidbox/shared, which its sync code imports instead of today's.
  const shared = git(['archive', sha, 'packages/shared'], top);
  execFileSync('tar', ['-x', '-C', root, '--strip-components=1', '--exclude=*/tsconfig.json'], { input: shared });
  for (const file of readdirSync(`${root}/sync`, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.ts')) continue;
    const path = `${root}/sync/${file}`;
    const toShared = relative(dirname(path), `${root}/shared`);
    const code = readFileSync(path, 'utf8').replace(
      /'@squidbox\/shared(\/[^']*)?'/g,
      (_, subpath: string | undefined) => `'${toShared}${subpath ?? '/index'}'`,
    );
    writeFileSync(path, code);
  }
  return root;
}

interface Phone {
  sqlite: Database.Database;
  db: SyncDb;
  /** Still the installed app (its code); false once updated. */
  old: boolean;
  /** The files it was told to remove, and the removeFiles that records them (removedFiles). */
  removed: string[];
  removeFiles: RemoveFiles;
}

for (const [index, build] of builds.entries())
  if (missing.includes(build)) describe.skip(`the build of ${build.name} (its commit could not be fetched)`, () => {});
  else describeBuild(build, { fuzz: index === 0 });
if (builds.length === 0) describe.skip('the installed builds (needs TEST_DATABASE_URL and a snapshot)', () => {});

// A build's suite; the seeded runs (`fuzz`) on the oldest build only.
function describeBuild(build: Build, { fuzz }: { fuzz: boolean }) {
  describe(`the build of ${build.name}: its client code, as built, against this server`, () => {
    const USER = randomUUID();
    let pool: pg.Pool;
    let pgDb: Db;
    let root: string; // the build's extracted src
    let firstNew: number; // the first migration the installed app lacks
    /* eslint-disable @typescript-eslint/no-explicit-any -- the installed app's modules, loaded at runtime */
    let main: {
      worker: any;
      assets: any;
      driver: any;
      schema: any;
    };

    const transport: SyncTransport = {
      push: async (req) => ({ results: await serverPush(pgDb, USER, req.mutations) }),
      pull: (req) => serverPull(pgDb, USER, { cursor: req.cursor, limit: req.limit }),
    };

    function installedPhone(): Phone {
      const sqlite = new Database(':memory:');
      runMigrations(sqlite, { folder: `${root}/sync/db/migrations` });
      return { sqlite, db: main.driver.createDb(betterSqliteExecutor(sqlite)), old: true, ...removedFiles() };
    }
    function newPhone(): Phone {
      const sqlite = new Database(':memory:');
      runMigrations(sqlite);
      return { sqlite, db: createDb(betterSqliteExecutor(sqlite)), old: false, ...removedFiles() };
    }
    // The app update: the current migrations on the installed app's database, then the current code,
    // opened as library/current.ts opens it (failed pushes retried, the owner kept).
    async function update(phone: Phone) {
      runMigrations(phone.sqlite, { from: firstNew });
      phone.db = createDb(betterSqliteExecutor(phone.sqlite));
      phone.old = false;
      await setOwner(phone.db, { kind: 'account', serverId: 's', userId: USER, email: '' });
      await retryFailures(phone.db);
    }
    async function sync(phone: Phone, now = S + 100_000) {
      at(now);
      if (phone.old) await main.worker.runSyncOnce(phone.db, transport, { removeFiles: phone.removeFiles });
      else await runSyncOnce(phone.db, transport, { removeFiles: phone.removeFiles });
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

    const synced = (row: Record<string, unknown> | undefined) => syncedFields('assets', row);
    async function serverAsset(id: string) {
      const { table, wireColumns } = serverCollections.assets!;
      // drizzle: the registry's table has no typed columns; for assets it is the assets table
      const assets = table as typeof serverSchema.assets;
      const [row] = await pgDb
        .select(wireColumns)
        .from(assets)
        .where(and(eq(assets.userId, USER), eq(assets.id, id)));
      return row;
    }
    async function localAsset(phone: Phone, id: string) {
      const table = phone.old ? main.schema.assets : clientSchema.assets;
      const [row] = await phone.db.select().from(table).where(eq(table.id, id));
      return row as Record<string, unknown> | undefined;
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
      root = extract(build);
      main = {
        worker: await import(/* @vite-ignore */ `${root}/sync/worker.ts`),
        assets: withVerbs(await import(/* @vite-ignore */ `${root}/sync/assetsRepository.ts`)),
        driver: await import(/* @vite-ignore */ `${root}/sync/db/driver.ts`),
        schema: await import(/* @vite-ignore */ `${root}/sync/db/schema.ts`),
      };
      // The update runs the migrations after the installed app's, which must be the first of the current ones.
      const hashes = (folder: string) => readMigrationFiles({ migrationsFolder: folder }).map(({ hash }) => hash);
      const installed = hashes(`${root}/sync/db/migrations`);
      expect(hashes(migrationsFolder).slice(0, installed.length)).toEqual(installed);
      firstNew = installed.length;
      pool = new pg.Pool({ connectionString: TEST_URL });
      pgDb = pgDrizzle(pool, { schema: serverSchema });
      await pgDb
        .insert(serverSchema.users)
        .values({ id: USER, email: `installed-build-${USER}@test.local`, passwordDigest: 'x', storageBucket: null });
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

    // A shipped migration can't be fixed (§15), and one SQLite refuses on a table with rows (`ADD …
    // NOT NULL` without a default passes on an empty one) would keep the library from opening: the
    // update runs over a row in every table the build has, a waiting edit in its outbox among them.
    it('the update takes a row in every table the build has, and the new app reads and syncs them', async () => {
      const M = installedPhone();
      const id = await seed([M]);
      await edit(M, S + 100, (a) => a.update(M.db, id, { notes: 'waiting in the outbox' }));
      await populateEveryTable(M.db, main.schema, id);
      const tables = M.sqlite
        .prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")
        .pluck()
        .all() as string[];
      const empty = tables.filter((name) => M.sqlite.prepare(`select count(*) from \`${name}\``).pluck().get() === 0);
      expect(empty, 'tables the seed left empty').toEqual([]);

      await update(M);
      for (const table of Object.values(clientSchema)) if (is(table, SQLiteTable)) await M.db.select().from(table);
      await sync(M);
      expect(await expectConverged(id, [M])).toMatchObject({ notes: 'waiting in the outbox' });
    });

    // A build pulls only the fields it knows; once updated to one that knows more, its next pull starts
    // from the beginning, so the values it dropped arrive (status.ts pullCursor).
    it('a photo the build pulled without its tags has them after the update (skipped for a build that stores tags)', async (ctx) => {
      if ('tags' in main.schema.assets) ctx.skip();
      const M = installedPhone();
      const N = newPhone();
      const id = await seed([M, N]);
      await edit(N, S + 100, (a) => a.update(N.db, id, { tags: ['x'] }));
      await sync(N);
      await sync(M);
      await update(M);
      await sync(M);
      expect(await localAsset(M, id)).toMatchObject({ tags: ['x'] });
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
    // server took stays; every app removes only the files of purges the server kept. FUZZ_SEEDS sets
    // how many runs; RUNS_FROM, RUNS_STEPS and RUNS_SKEWS (ms per phone, comma-separated) widen them
    // by hand.
    it.runIf(fuzz)(
      'seeded runs of installed and new apps, with updates mid-run, converge every time',
      async () => {
        const SKEWS = process.env.RUNS_SKEWS ? process.env.RUNS_SKEWS.split(',').map(Number) : [0, -700, 900];
        const from = Number(process.env.RUNS_FROM ?? 1);
        for (let n = from; n < from + fuzzRuns(3, 24); n++) {
          let state = n * 7919;
          const rand = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
          const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
          await pgDb.delete(serverSchema.assets).where(eq(serverSchema.assets.userId, USER));
          const phones = [installedPhone(), installedPhone(), newPhone()];
          const skew = new Map(phones.map((phone, i) => [phone, SKEWS[i]!]));
          const ids: string[] = [];
          for (let i = 0; i < 3; i++)
            ids.push(
              await seed(phones, {
                filename: `f${i}.jpg`,
                thumbnailFilename: `t${i}.jpg`,
                deletedAt: i === 0 ? S : null,
              }),
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
                    `  push ${ids.indexOf(r.id)} ${JSON.stringify(req.mutations[i]!.fields ?? 'whole')} del=${req.mutations[i]!.record.deletedAt} purge=${req.mutations[i]!.record.purgedAt} → ${r.status}${r.current ? ` del=${r.current.deletedAt} purge=${r.current.purgedAt}` : ''}`,
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
            if (phone.old) await main.worker.runSyncOnce(phone.db, timed, { removeFiles: phone.removeFiles });
            else await runSyncOnce(phone.db, timed, { removeFiles: phone.removeFiles });
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
      },
      240_000,
    );
  });
}

// Needed while an installed build older than the repositories' shared verbs is supported: those name them
// after the collection. Delete it once the oldest build has `create`, `update`, `remove` and the rest.
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
