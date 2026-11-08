import { and, eq, isNull } from 'drizzle-orm';
import { alias, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import { a, photoContactNames } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { matchingIds } from '@/sync/matchingIds';

const al = alias(schema.albums, 'al');
const aa = alias(schema.albumAssets, 'aa');

/**
 * The album search, as SQL: `read(db)` → the ids of the live albums whose name, notes or contacts
 * (those on the album's live photos, as albumQuery's `{ contactId }` scope) contain `search`, matched
 * as `matchingIds` does, or `null` without a search (no statement runs); `tables` → what a live read
 * watches, nothing without a search. Its own small read, so a keystroke re-reads no album stats
 * (albumQuery). Smart albums have no edges: only their names match.
 */
export default function albumSearchQuery(search: string) {
  const searchText = search.trim();
  const tables: SQLiteTable[] = searchText
    ? [schema.albums, schema.albumAssets, schema.assets, schema.contactLinks, schema.contacts]
    : [];

  return {
    descriptor: { search },
    tables,
    read(db: SyncDb): Promise<string[] | null> {
      if (!searchText) return Promise.resolve(null);
      return db.transaction(async (tx) => {
        const albums = await tx
          .select({ id: al.id, name: al.name, notes: al.notes })
          .from(al)
          .where(isNull(al.deletedAt));
        const contactNames = await tx
          .select({ id: aa.albumId, text: photoContactNames.name })
          .from(aa)
          .innerJoin(photoContactNames, eq(photoContactNames.photoId, aa.assetId))
          .innerJoin(a, and(eq(a.id, aa.assetId), isNull(a.deletedAt)))
          .where(isNull(aa.deletedAt));
        const rows = albums.flatMap(({ id, name, notes }) => [
          { id, text: name },
          ...(notes === null ? [] : [{ id, text: notes }]),
        ]);
        return matchingIds([...rows, ...contactNames], searchText);
      });
    },
  };
}
