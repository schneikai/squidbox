import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { contactAlbumEdges } from '@/sync/assetSql';
import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { matchingContactIds } from '@/sync/queries/contactQuery';

/** What an album search read: its text, and the albums holding a live photo of a contact it finds. */
export type AlbumContactSearch = { search: string; contactAlbumIds: string[] };

/**
 * The album search's SQL part: `read(db)` → the albums holding a live photo of a contact the search
 * finds (matchingContactIds, the Contacts tab's search; as albumQuery's `{ contactId }` scope,
 * contactAlbumEdges), deleted ones included (the list's rows leave them out), with the search it was
 * read for; without a search none, and no statement runs. `tables` → what a live read watches,
 * nothing without a search. The names and notes match in JS over the rows the list already has
 * (matchedAlbumIds), so a keystroke re-reads no album stats (albumQuery).
 */
export default function albumSearchQuery(search: string) {
  const searchText = search.trim();
  const tables: SQLiteTable[] = searchText
    ? [schema.contacts, schema.contactLinks, schema.albumAssets, schema.assets]
    : [];

  return {
    descriptor: { search: searchText },
    tables,
    async read(db: SyncDb): Promise<AlbumContactSearch> {
      if (!searchText) return { search: searchText, contactAlbumIds: [] };
      const edges = await db.transaction(async (tx) => {
        const contactIds = await matchingContactIds(tx, searchText);
        if (!contactIds.length) return [];
        return tx
          .selectDistinct({ albumId: schema.albumAssets.albumId })
          .from(schema.albumAssets)
          .where(contactAlbumEdges(contactIds));
      });
      return { search: searchText, contactAlbumIds: edges.map((edge) => edge.albumId) };
    },
  };
}
