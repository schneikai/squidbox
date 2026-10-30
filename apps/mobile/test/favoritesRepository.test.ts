import { fakeClock } from '@squidbox/shared/testing/fakeClock';
import { tick } from '@squidbox/shared/testing/tick';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { makeTestDb } from './helpers/testDb';
import * as schema from '../src/sync/db/schema';
import type { SyncDb } from '../src/sync/db/types';
import {
  ALREADY_IN_FAVORITES,
  addFavorites,
  countFavorites,
  readFavorite,
  readFavorites,
  removeFavorite,
  restoreFavorite,
  updateFavorite,
} from '../src/sync/favoritesRepository';
import { clearOutboxRows } from '../src/sync/outbox';

const texts = async (db: SyncDb) => (await readFavorites(db)).map((row) => row.text);
const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'favorites'));

// One add per call, the clock moved on after each, so each has its own (later) createdAt.
async function addEach(db: SyncDb, list: string[]) {
  for (const text of list) {
    await addFavorites(db, [text], null);
    tick();
  }
}

describe('favoritesRepository', () => {
  it('reads the live favorites newest first, and counts them', async () => {
    fakeClock();
    const db = makeTestDb();
    await addEach(db, ['first', 'second', 'third']);
    expect(await texts(db)).toEqual(['third', 'second', 'first']);
    expect(await countFavorites(db)).toBe(3);
  });

  it('adds each text once, trimmed, without the empty ones and those already there', async () => {
    const db = makeTestDb();
    await addFavorites(db, ['First light.'], 'Shorter');
    const created = await addFavorites(db, [' First light. ', 'Fog on the lake.', 'Fog on the lake.', '  '], null);
    expect(created.map((row) => row.text)).toEqual(['Fog on the lake.']);
    expect((await texts(db)).sort()).toEqual(['First light.', 'Fog on the lake.']);
    expect((await readFavorites(db)).find((row) => row.text === 'First light.')!.source).toBe('Shorter');
  });

  it("changes a favorite's text, but not to one another favorite has", async () => {
    const db = makeTestDb();
    const [light, fog] = await addFavorites(db, ['First light.', 'Fog on the lake.'], null);
    await updateFavorite(db, light!.id, ' First light, again. ');
    expect((await readFavorite(db, light!.id))!.text).toBe('First light, again.');
    await expect(updateFavorite(db, light!.id, 'Fog on the lake.')).rejects.toThrow(ALREADY_IN_FAVORITES);
    expect((await readFavorite(db, fog!.id))!.text).toBe('Fog on the lake.');
  });

  it('removes one, and Undo brings it back with only deletedAt in the outbox', async () => {
    const db = makeTestDb();
    const [light] = await addFavorites(db, ['First light.'], null);
    await removeFavorite(db, light!.id);
    expect(await readFavorite(db, light!.id)).toBeNull();
    expect(await countFavorites(db)).toBe(0);
    await clearOutboxRows(db, 'favorites', [light!.id]);
    await restoreFavorite(db, light!.id);
    expect(await readFavorite(db, light!.id)).toMatchObject({ text: 'First light.', deletedAt: null });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['deletedAt']);
  });

  it('restores nothing for a favorite that was never removed', async () => {
    const db = makeTestDb();
    const [light] = await addFavorites(db, ['First light.'], null);
    await clearOutboxRows(db, 'favorites', [light!.id]);
    await restoreFavorite(db, light!.id);
    expect(await outbox(db)).toHaveLength(0);
  });

  it('adds a removed text again as a new favorite', async () => {
    const db = makeTestDb();
    const [light] = await addFavorites(db, ['First light.'], null);
    await removeFavorite(db, light!.id);
    const [again] = await addFavorites(db, ['First light.'], null);
    expect(again!.id).not.toBe(light!.id);
    expect(await texts(db)).toEqual(['First light.']);
  });
});
