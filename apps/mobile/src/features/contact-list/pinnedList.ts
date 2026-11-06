import type * as schema from '@/sync/db/schema';

/**
 * The list pinned to the top of Contacts in place of Favorites: the one pinned last, should two
 * devices have pinned one each before they synced; null for Favorites.
 */
export default function pinnedList<T extends Pick<schema.ContactListRow, 'pinnedAt'>>(
  lists: T[] | undefined,
): T | null {
  let pinned: T | null = null;
  for (const list of lists ?? []) {
    if (list.pinnedAt != null && (pinned === null || list.pinnedAt > pinned.pinnedAt!)) pinned = list;
  }
  return pinned;
}
