import { MIN_REREAD_INTERVAL } from '@/constants';
import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQueryState } from '@/sync/useLiveQuery';

/**
 * The albums of `scope` with their stats, live (albumQuery; `options`: its `withLastPostedAt`, and
 * useLiveQuery's `isLive`): `rows` (`undefined` until read) and their `readAt`.
 */
export default function useAlbumRows(scope, { withLastPostedAt, isLive } = {}) {
  const { albumSortOrders } = useAppSettings();
  // Only the ids the query reads, so another album sort change doesn't re-read the albums.
  const oldestFirstIds = Object.keys(albumSortOrders)
    .filter((id) => albumSortOrders[id] === 'createdAt:asc')
    .sort();
  const query = albumQuery({ scope, oldestFirstIds, withLastPostedAt });
  const { data, readAt } = useLiveQueryState(query.read, query.tables, [query.descriptor], {
    minInterval: MIN_REREAD_INTERVAL,
    isLive,
  });
  return { rows: data, readAt };
}
