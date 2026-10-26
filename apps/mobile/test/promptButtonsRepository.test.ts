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
  ['d1', 'd2', 'd3', 'a', 'b', 'c', 'd', 'n1', 'n2'].map((name, i) => [
    name,
    `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  ]),
);
const NAME = (id: string) => Object.keys(ID).find((name) => ID[name] === id);

const button = (name: string, placement: 'post' | 'newPost' | 'refine' = 'refine') => ({
  id: ID[name]!,
  name: `Button ${name}`,
  prompt: `Prompt ${name}`,
  placement,
  icon: null,
});
const defaults = [button('d1', 'post'), button('d2', 'post'), button('d3', 'refine')];

// The live buttons' ids of a placement, in order.
async function order(db: SyncDb, placement: string): Promise<string[]> {
  return (await readPromptButtons(db)).filter((row) => row.placement === placement).map((row) => NAME(row.id));
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
    expect(await order(db, 'post')).toEqual(['d1', 'd2']);
    expect(await order(db, 'refine')).toEqual(['d3']);
    expect(await seedPromptButtons(db, defaults)).toBe(false);
    expect(await readPromptButtons(db)).toHaveLength(3);
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

  it('creates a button at the end of its placement', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await createPromptButton(db, button('n1', 'post'));
    await createPromptButton(db, button('n2', 'newPost'));
    expect(await order(db, 'post')).toEqual(['d1', 'd2', 'n1']);
    expect(await order(db, 'newPost')).toEqual(['n2']);
  });

  it('moves a button to the front and into the middle', async () => {
    const db = makeTestDb();
    for (const id of ['a', 'b', 'c', 'd']) await createPromptButton(db, button(id));
    await movePromptButton(db, ID.c!, null);
    expect(await order(db, 'refine')).toEqual(['c', 'a', 'b', 'd']);
    await movePromptButton(db, ID.c!, ID.b!);
    expect(await order(db, 'refine')).toEqual(['a', 'b', 'c', 'd']);
    await movePromptButton(db, ID.a!, ID.d!);
    expect(await order(db, 'refine')).toEqual(['b', 'c', 'd', 'a']);
  });

  it('puts a button moved to another placement at the end of that group', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await updatePromptButton(db, ID.d1!, { placement: 'refine', name: 'Moved' });
    expect(await order(db, 'post')).toEqual(['d2']);
    expect(await order(db, 'refine')).toEqual(['d3', 'd1']);
    expect((await readPromptButtons(db)).find((row) => NAME(row.id) === 'd1')!.name).toBe('Moved');
  });

  it('keeps the position of an edit in the same placement', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await updatePromptButton(db, ID.d1!, { placement: 'post', prompt: 'New prompt' });
    expect(await order(db, 'post')).toEqual(['d1', 'd2']);
  });

  it('deletes a button as a tombstone', async () => {
    const db = await syncedDb();
    await seedPromptButtons(db, defaults);
    await removePromptButton(db, ID.d2!);
    expect(await order(db, 'post')).toEqual(['d1']);
    const rows = await db.select().from(schema.promptButtons);
    expect(rows.find((row) => NAME(row.id) === 'd2')!.deletedAt).not.toBeNull();
  });
});
