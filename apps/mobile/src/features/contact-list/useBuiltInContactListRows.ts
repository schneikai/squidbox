import { builtInContactListsQuery as query } from './builtInContactLists';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The built-in lists (Favorites, Tagged, Deleted), live, with their counts and first contacts;
 * undefined while reading. `isLive: false` stops re-reading them, say while they are hidden.
 */
export default function useBuiltInContactListRows({ isLive }: { isLive?: boolean } = {}) {
  return useLiveQuery((db) => query.read(db), query.tables, [query.descriptor], { isLive });
}
