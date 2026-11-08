import { and, isNull, sql } from 'drizzle-orm';
import { alias, type SQLiteTable } from 'drizzle-orm/sqlite-core';

import { contactAlbumIds } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { matchingContactIds } from '@/sync/matchingContactIds';

const al = alias(schema.albums, 'al');

/** What an album search read: its text, and the albums holding a live photo of a contact it matches. */
export type AlbumContactSearch = { search: string; contactAlbumIds: string[] };

/**
 * The album search's SQL part: `read(db)` → the live albums holding a live photo of a contact whose
 * name contains `search` (matchingContactIds; as albumQuery's `{ contactId }` scope, contactAlbumIds),
 * with the search it was read for; without a search none, and no statement runs. `tables` → what a
 * live read watches, nothing without a search. The names and notes match in JS over the rows the
 * list already has (matchedAlbumIds), so a keystroke re-reads no album stats (albumQuery).
 */
export default function albumSearchQuery(search: string) {
  const searchText = search.trim();
  const tables: SQLiteTable[] = searchText
    ? [schema.contacts, schema.contactLinks, schema.albumAssets, schema.assets, schema.albums]
    : [];

  return {
    descriptor: { search: searchText },
    tables,
    async read(db: SyncDb): Promise<AlbumContactSearch> {
      if (!searchText) return { search: searchText, contactAlbumIds: [] };
      const contactAlbums = await db.transaction(async (tx) => {
        const contactIds = await matchingContactIds(tx, searchText);
        if (!contactIds.length) return [];
        return tx
          .select({ id: al.id })
          .from(al)
          .where(and(isNull(al.deletedAt), sql`al.id in ${contactAlbumIds(contactIds)}`));
      });
      return { search: searchText, contactAlbumIds: contactAlbums.map((row) => row.id) };
    },
  };
}
