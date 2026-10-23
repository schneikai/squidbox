import { sql } from 'drizzle-orm';
import { describe, it, expect, beforeEach } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { makeTestDb } from './helpers/testDb';
import * as repo from '../src/sync/assetsRepository';
import type { AppDb } from '../src/sync/db/driver';
import * as schema from '../src/sync/db/schema';
import { setCursor } from '../src/sync/status';

let db: AppDb;
let changes: string[][];
beforeEach(() => {
  db = makeTestDb();
  changes = [];
  db.onTablesChanged((tables) => changes.push([...tables].sort()));
});

describe('driver (createDb)', () => {
  it('runs a write issued during a transaction only after it commits', async () => {
    const order: string[] = [];
    const transaction = db.transaction(async (tx) => {
      await tx.insert(schema.assets).values({ ...makeAssetRecord({ filename: 'in-tx.jpg' }), syncError: null });
      await new Promise((resolve) => setTimeout(resolve, 10)); // give an outside write a chance to interleave
      order.push('transaction');
    });
    const outside = setCursor(db, 7).then(() => order.push('outside'));
    await Promise.all([transaction, outside]);
    expect(order).toEqual(['transaction', 'outside']);
  });

  it('notifies once per committed transaction, with the tables it wrote', async () => {
    await repo.create(db, makeAssetRecord({ filename: 'a.jpg' })); // asset row + outbox row
    expect(changes).toEqual([['assets', 'outbox']]);
  });

  it('commits a bulk update as one unit', async () => {
    const [a, b] = await repo.createMany(db, [makeAssetRecord(), makeAssetRecord()]);
    changes = [];
    await repo.updateMany(db, { [a!.id]: { isFavorite: true }, [b!.id]: { isFavorite: true } });
    expect(changes).toEqual([['assets', 'outbox']]);
  });

  it('discards a rolled-back transaction without notifying', async () => {
    const failing = db.transaction(async (tx) => {
      await tx.insert(schema.assets).values({ ...makeAssetRecord({ filename: 'gone.jpg' }), syncError: null });
      throw new Error('boom');
    });
    await expect(failing).rejects.toThrow('boom');
    expect(await db.select().from(schema.assets)).toHaveLength(0);
    expect(changes).toEqual([]);
  });

  it('does not notify for a write that changed no rows', async () => {
    const [a] = await repo.createMany(db, [makeAssetRecord()]);
    changes = [];
    await repo.setSyncError(db, [a!.id], null); // already null: the update matches nothing
    expect(changes).toEqual([]);
  });

  it('does not notify for reads', async () => {
    await db.select().from(schema.assets);
    expect(changes).toEqual([]);
  });

  it("accepts drizzle-kit's backtick-quoted migration writes", async () => {
    await db.run(sql.raw('CREATE TABLE `__new_things` (`id` text PRIMARY KEY)'));
    await db.run(sql.raw("INSERT INTO `__new_things`(`id`) VALUES ('a')"));
    expect(changes).toContainEqual(['__new_things']);
  });

  it('refuses a write it cannot attribute to a table, which live reads would miss', async () => {
    await expect(db.run(sql`update assets set notes = 'x'`)).rejects.toThrow(/Untracked write/);
  });

  it('commits repository writes made inside a transaction once, as savepoints', async () => {
    const [a] = await repo.createMany(db, [makeAssetRecord()]);
    changes = [];
    await db.transaction(async (tx) => {
      await repo.update(tx, a!.id, { notes: 'one' });
      await repo.toggleFavorite(tx, a!.id);
    });
    expect(changes).toEqual([['assets', 'outbox']]);
  });

  it('close waits for the queued work and refuses what is queued after it', async () => {
    const created = repo.create(db, makeAssetRecord({ filename: 'before-close.jpg' }));
    const closing = db.close();
    const after = db.select().from(schema.assets);
    await expect(created).resolves.toMatchObject({ filename: 'before-close.jpg' });
    await expect(closing).resolves.toBeUndefined();
    await expect(after).rejects.toThrow('The database is closed');
    await expect(setCursor(db, 1)).rejects.toThrow('The database is closed');
  });

  it('skips the statements and transactions of a cancellable db cancelled by their turn', async () => {
    let isCancelled = false;
    const reads = db.cancellable(() => isCancelled);
    let release = () => {};
    const busy = db.transaction(() => new Promise<void>((resolve) => (release = resolve)));
    const select = () =>
      reads
        .select({ id: schema.assets.id })
        .from(schema.assets)
        .then((rows) => rows); // queues it
    await new Promise((resolve) => setTimeout(resolve, 5)); // the transaction holds the queue

    const before = select(); // queued while still wanted, cancelled before its turn
    const inTransaction = reads.transaction((tx) => tx.select().from(schema.assets));
    isCancelled = true;
    release();
    await busy;
    await expect(before).rejects.toThrow('cancelled');
    await expect(inTransaction).rejects.toThrow('cancelled');

    isCancelled = false;
    expect(await select()).toEqual([]);
  });

  it('refuses writes on a cancellable db, alone or in a transaction', async () => {
    const reads = db.cancellable(() => false);
    const changed: Set<string>[] = [];
    db.onTablesChanged((tables) => changed.push(tables));

    await expect(setCursor(reads, 1)).rejects.toThrow('only reads');
    await expect(repo.create(reads, makeAssetRecord())).rejects.toThrow('only reads');

    expect(changed).toEqual([]);
    expect(await db.select().from(schema.assets)).toEqual([]);
    expect(await reads.select().from(schema.assets)).toEqual([]); // reads still run
  });

  it('runs only reads on a cancellable db: DDL, CTE writes and pragma assignments are refused', async () => {
    const reads = db.cancellable(() => false);

    await expect(reads.run(sql`create table t (id integer)`)).rejects.toThrow('only reads');
    await expect(reads.run(sql`drop table sync_meta`)).rejects.toThrow('only reads');
    await expect(
      reads.run(sql`with gone as (select id from assets) delete from assets where id in gone`),
    ).rejects.toThrow('only reads');
    await expect(reads.run(sql`pragma user_version = 7`)).rejects.toThrow('only reads');
    await expect(reads.run(sql`pragma foreign_keys(0)`)).rejects.toThrow('only reads');

    expect(await reads.all(sql`with ids as (select id from assets) select count(*) from ids`)).toEqual([[0]]);
    expect(await reads.all(sql`pragma user_version`)).toHaveLength(1);
    expect(await reads.transaction((tx) => tx.select().from(schema.assets))).toEqual([]);
    expect(await db.all(sql`select name from sqlite_master where name = 't'`)).toEqual([]);
  });
});
