import { count, desc } from 'drizzle-orm';

import * as schema from './db/schema';
import { useLiveQuery } from './useLiveQuery';
import { useRecordCounts } from './useRecordCounts';

// Reactive data for the Sync Inspector, counted and ordered in SQL.

export interface CollectionStats {
  name: string;
  records: number; // live (non-tombstoned)
  tombstones: number;
  pending: number;
}

const SYNC_LOG_SHOWN = 30;
const NO_ROWS: never[] = [];

export function useCollectionStats(): CollectionStats[] {
  const assets = useRecordCounts(schema.assets);
  const albums = useRecordCounts(schema.albums);
  const posts = useRecordCounts(schema.posts);
  const contacts = useRecordCounts(schema.contacts);
  const contactLists = useRecordCounts(schema.contactLists);
  const contactListMembers = useRecordCounts(schema.contactListMembers);
  const contactLinks = useRecordCounts(schema.contactLinks);
  const pending =
    useLiveQuery(
      (db) =>
        db
          .select({ collection: schema.outbox.collection, count: count() })
          .from(schema.outbox)
          .groupBy(schema.outbox.collection),
      [schema.outbox],
    ) ?? NO_ROWS;

  const pendingByCollection = new Map(pending.map((row) => [row.collection, row.count]));
  const stat = (name: string, counts: { records: number; tombstones: number }): CollectionStats => ({
    name,
    ...counts,
    pending: pendingByCollection.get(name) ?? 0,
  });

  return [
    stat('assets', assets),
    stat('albums', albums),
    stat('posts', posts),
    stat('contacts', contacts),
    stat('contact_lists', contactLists),
    stat('contact_list_members', contactListMembers),
    stat('contact_links', contactLinks),
  ];
}

export function useSyncLogRows(): schema.SyncLogRow[] {
  return (
    useLiveQuery(
      (db) => db.select().from(schema.syncLog).orderBy(desc(schema.syncLog.id)).limit(SYNC_LOG_SHOWN),
      [schema.syncLog],
    ) ?? NO_ROWS
  );
}
