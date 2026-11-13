import { builtInContactListsQuery as query } from '@/sync/queries/builtInContactLists';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The built-in lists (Favorites, Tagged, Deleted), live, with their counts and first contacts;
 * undefined while reading.
 */
export default function useBuiltInContactListRows() {
  return useLiveQuery((db) => query.read(db), query.tables, [query.descriptor]);
}
