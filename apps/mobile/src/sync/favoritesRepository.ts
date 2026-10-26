import { favoriteCollection, type FavoriteRecord } from '@squidbox/shared';
import { and, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

import newRecord from '@/utils/newRecord';

// Favorites (Settings → Assistant → Favorites): the posts the assistant writes like. The only reader
// and writer of the favorites table. Newest first; a removal is a tombstone that Undo restores.

const t = schema.favorites;
const repository = makeRepository<FavoriteRecord>('favorites', t);

/** What updateFavorite throws for a text another favorite already has. */
export const ALREADY_IN_FAVORITES = 'Already in Favorites';

const newestFirst = [desc(t.createdAt), desc(t.id)];

/** The live favorites, newest first. */
export async function readFavorites(db: SyncDb): Promise<FavoriteRecord[]> {
  return (await db
    .select()
    .from(t)
    .where(isNull(t.deletedAt))
    .orderBy(...newestFirst)) as FavoriteRecord[];
}

/** One live favorite, or null when it's gone (removed, here or on another device). */
export async function readFavorite(db: SyncDb, id: string): Promise<FavoriteRecord | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.id, id), isNull(t.deletedAt)));
  return (row as FavoriteRecord | undefined) ?? null;
}

/** How many live favorites there are. */
export async function countFavorites(db: SyncDb): Promise<number> {
  const [{ favorites }] = await db.select({ favorites: count() }).from(t).where(isNull(t.deletedAt));
  return favorites;
}

/**
 * Add `texts` as favorites from `source` (null: your own post): trimmed, the empty ones dropped,
 * each once, and none a live favorite already has. Returns the ones it created.
 */
export async function addFavorites(db: SyncDb, texts: string[], source: string | null): Promise<FavoriteRecord[]> {
  const wanted = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  if (wanted.length === 0) return [];
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ text: t.text })
      .from(t)
      .where(and(isNull(t.deletedAt), inArray(t.text, wanted)));
    const taken = new Set(existing.map((row) => row.text));
    const records = wanted
      .filter((text) => !taken.has(text))
      .map((text) => newRecord(favoriteCollection, {}, { text, source }) as FavoriteRecord);
    await saveRecords(tx, 'favorites', t, records, { isNew: true });
    return records;
  });
}

/** Change a favorite's text (trimmed); throws ALREADY_IN_FAVORITES when another live one has it. */
export async function updateFavorite(db: SyncDb, id: string, text: string): Promise<void> {
  const trimmed = text.trim();
  await db.transaction(async (tx) => {
    const [twin] = await tx
      .select({ id: t.id })
      .from(t)
      .where(and(isNull(t.deletedAt), eq(t.text, trimmed), ne(t.id, id)));
    if (twin) throw new Error(ALREADY_IN_FAVORITES);
    await repository.update(tx, id, { text: trimmed });
  });
}

/** Remove a favorite (a tombstone, which restoreFavorite takes back). */
export function removeFavorite(db: SyncDb, id: string): Promise<void> {
  return repository.remove(db, [id]);
}

/**
 * Undo a removal: `deletedAt` back to null, a per-field write, so a later removal on another device
 * still wins by its clock. Nothing for a favorite that isn't removed.
 */
export function restoreFavorite(db: SyncDb, id: string): Promise<void> {
  return repository.update(db, id, { deletedAt: null });
}
