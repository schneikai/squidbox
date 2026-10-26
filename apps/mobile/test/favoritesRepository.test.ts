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
  readFavoriteTexts,
  readFavorites,
  removeFavorite,
  restoreFavorite,
  updateFavorite,
} from '../src/sync/favoritesRepository';
import { clearOutboxRows } from '../src/sync/outbox';

const texts = async (db: SyncDb) => (await readFavorites(db)).map((row) => row.text);
const outbox = (db: SyncDb) => db.select().from(schema.outbox).where(eq(schema.outbox.collection, 'favorites'));

// One add per call, so each has its own (later) createdAt.
async function addEach(db: SyncDb, list: string[]) {
  for (const text of list) {
    await addFavorites(db, [text], null);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

describe('favoritesRepository', () => {
  it('reads the live favorites newest first, and counts them', async () => {
    const db = makeTestDb();
    await addEach(db, ['first', 'second', 'third']);
    expect(await texts(db)).toEqual(['third', 'second', 'first']);
    expect(await readFavoriteTexts(db, 2)).toEqual(['third', 'second']);
    expect(await countFavorites(db)).toBe(3);
  });

  it('adds each text once, trimmed, without the empty ones and those already there', async () => {
    const db = makeTestDb();
    await addFavorites(db, ['Leg day.'], 'Shorter');
    const created = await addFavorites(db, [' Leg day. ', 'Sheets still warm.', 'Sheets still warm.', '  '], null);
    expect(created.map((row) => row.text)).toEqual(['Sheets still warm.']);
    expect((await texts(db)).sort()).toEqual(['Leg day.', 'Sheets still warm.']);
    expect((await readFavorites(db)).find((row) => row.text === 'Leg day.')!.source).toBe('Shorter');
  });

  it("changes a favorite's text, but not to one another favorite has", async () => {
    const db = makeTestDb();
    const [leg, sheets] = await addFavorites(db, ['Leg day.', 'Sheets still warm.'], null);
    await updateFavorite(db, leg!.id, ' Leg day, again. ');
    expect((await readFavorite(db, leg!.id))!.text).toBe('Leg day, again.');
    await expect(updateFavorite(db, leg!.id, 'Sheets still warm.')).rejects.toThrow(ALREADY_IN_FAVORITES);
    expect((await readFavorite(db, sheets!.id))!.text).toBe('Sheets still warm.');
  });

  it('removes one, and Undo brings it back with only deletedAt in the outbox', async () => {
    const db = makeTestDb();
    const [leg] = await addFavorites(db, ['Leg day.'], null);
    await removeFavorite(db, leg!.id);
    expect(await readFavorite(db, leg!.id)).toBeNull();
    expect(await countFavorites(db)).toBe(0);
    await clearOutboxRows(db, 'favorites', [leg!.id]);
    await restoreFavorite(db, leg!.id);
    expect(await readFavorite(db, leg!.id)).toMatchObject({ text: 'Leg day.', deletedAt: null });
    const [row] = await outbox(db);
    expect(Object.keys(row!.fields)).toEqual(['deletedAt']);
  });

  it('restores nothing for a favorite that was never removed', async () => {
    const db = makeTestDb();
    const [leg] = await addFavorites(db, ['Leg day.'], null);
    await clearOutboxRows(db, 'favorites', [leg!.id]);
    await restoreFavorite(db, leg!.id);
    expect(await outbox(db)).toHaveLength(0);
  });

  it('adds a removed text again as a new favorite', async () => {
    const db = makeTestDb();
    const [leg] = await addFavorites(db, ['Leg day.'], null);
    await removeFavorite(db, leg!.id);
    const [again] = await addFavorites(db, ['Leg day.'], null);
    expect(again!.id).not.toBe(leg!.id);
    expect(await texts(db)).toEqual(['Leg day.']);
  });
});
