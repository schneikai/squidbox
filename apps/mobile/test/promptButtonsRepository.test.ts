import { mergeRecord, promptButtonCollection } from '@squidbox/shared';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  createPromptButton,
  movePromptButton,
  readPromptButtons,
  removePromptButton,
  seedPromptButtons,
  updatePromptButton,
} from '../src/sync/promptButtonsRepository';
import { markFirstSyncDone } from '../src/sync/status';

// A uuid per short name, so the tests read by name.
const ID: Record<string, string> = Object.fromEntries(
  ['d1', 'd2', 'd3', 'a', 'b', 'c', 'd', 'n1', 'n2', 'd4', 'd5', 'c1', 'c2'].map((name, i) => [
    name,
    `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  ]),
);
const NAME = (id: string) => Object.keys(ID).find((name) => ID[name] === id);

const button = (name: string) => ({
  id: ID[name]!,
  name: `Button ${name}`,
  prompt: `Prompt ${name}`,
  icon: null,
});
const defaults = ['d1', 'd2', 'd4', 'd5', 'd3'].map(button);

// The live buttons' ids, in order.
async function order(db: SyncDb): Promise<string[]> {
  return (await readPromptButtons(db)).map((row) => NAME(row.id)!);
}

// A library after its first full pull, when seeding may run.
async function syncedDb(): Promise<SyncDb> {
  const db = makeTestDb();
  await markFirstSyncDone(db);
  return db;
}

describe('promptButtonsRepository', () => {
  it('seeds the defaults once, in their order', async () => {
    const db = await syncedDb();
    expect(await seedPromptButtons(db, defaults)).toBe(true);
    expect(await order(db)).toEqual(['d1', 'd2', 'd4', 'd5', 'd3']);
    expect(await seedPromptButtons(db, defaults)).toBe(false);
    expect(await readPromptButtons(db)).toHaveLength(5);
  });

  it('adds a new default to a library that has buttons once, at the end', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults.slice(0, 4));
    await removePromptButton(db, ID.d4!);
    await createPromptButton(db, button('a'));
    const later = [...defaults, button('c1'), button('c2')];
    expect(await seedPromptButtons(db, later)).toBe(true);
    expect(await order(db)).toEqual(['d1', 'd2', 'd5', 'a', 'd3', 'c1', 'c2']);
    expect(await seedPromptButtons(db, later)).toBe(false);
  });

  it("seeds at the lowest clock, so another device's deletion of a default wins on the server", async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    const [seeded] = await db.select().from(schema.promptButtons).where(eq(schema.promptButtons.id, ID.d5!));
    expect(seeded!.updatedAt).toBe(1);
    const [queued] = await db.select().from(schema.outbox).where(eq(schema.outbox.recordId, ID.d5!));
    expect(Object.values(queued!.fields).every((clock) => clock === 1)).toBe(true);

    // The server holds the default as another device deleted it, then this device's seed arrives.
    const deletedAt = Date.now();
    const stored = { ...seeded!, updatedAt: deletedAt, deletedAt };
    const clocks = Object.fromEntries(promptButtonCollection.mergeFields.map((field) => [field, deletedAt]));
    const merged = mergeRecord(promptButtonCollection, {
      stored,
      storedClocks: clocks,
      sent: queued!.payload as typeof stored,
      sentClocks: queued!.fields,
    });
    expect(merged.applied).toEqual([]);
    expect(merged.record.deletedAt).toBe(deletedAt);
  });

  it('waits for the first full pull before seeding', async () => {
    const db = makeTestDb();
    expect(await seedPromptButtons(db, defaults)).toBe(false);
    await markFirstSyncDone(db);
    expect(await seedPromptButtons(db, defaults)).toBe(true);
  });

  it('never seeds again after every button was deleted', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    for (const { id } of defaults) await removePromptButton(db, id);
    expect(await readPromptButtons(db)).toEqual([]);
    expect(await seedPromptButtons(db, defaults)).toBe(false);
    expect(await readPromptButtons(db)).toEqual([]);
  });

  it('creates a button at the end', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await createPromptButton(db, button('n1'));
    expect(await order(db)).toEqual(['d1', 'd2', 'd4', 'd5', 'd3', 'n1']);
  });

  it('moves a button to the front and into the middle', async () => {
    const db = makeTestDb();
    for (const id of ['a', 'b', 'c', 'd']) await createPromptButton(db, button(id));
    await movePromptButton(db, ID.c!, null);
    expect(await order(db)).toEqual(['c', 'a', 'b', 'd']);
    await movePromptButton(db, ID.c!, ID.b!);
    expect(await order(db)).toEqual(['a', 'b', 'c', 'd']);
    await movePromptButton(db, ID.a!, ID.d!);
    expect(await order(db)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('keeps the position of an edit', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await updatePromptButton(db, ID.d1!, { name: 'Renamed', prompt: 'New prompt' });
    expect(await order(db)).toEqual(['d1', 'd2', 'd4', 'd5', 'd3']);
    expect((await readPromptButtons(db))[0]!.name).toBe('Renamed');
  });

  it('deletes a button as a tombstone', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await removePromptButton(db, ID.d2!);
    expect(await order(db)).toEqual(['d1', 'd4', 'd5', 'd3']);
    const rows = await db.select().from(schema.promptButtons);
    expect(rows.find((row) => NAME(row.id) === 'd2')!.deletedAt).not.toBeNull();
  });
});
