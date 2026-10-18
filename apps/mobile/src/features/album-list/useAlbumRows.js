import { MIN_REREAD_INTERVAL } from '@/constants';
import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQueryState } from '@/sync/useLiveQuery';

/**
 * The albums of `scope` with their stats, live (albumQuery; `options`: its `withLastPostedAt`, and
 * useLiveQuery's `isLive`): `rows` (`undefined` until read) and their `readAt`.
 */
export default function useAlbumRows(scope, { withLastPostedAt, isLive } = {}) {
  const { albumSortOrder } = useAppSettings();
  const query = albumQuery({ scope, assetSort: albumSortOrder, withLastPostedAt });
  const { data, readAt } = useLiveQueryState(query.read, query.tables, [query.descriptor], {
    minInterval: MIN_REREAD_INTERVAL,
    isLive,
  });
  return { rows: data, readAt };
}
