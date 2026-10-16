import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQuery } from '@/sync/useLiveQuery';

// The stats re-read is slow (a few hundred ms): during a write burst (a pull, a bulk action, a
// backup) re-read at most about once a second.
const MIN_REREAD_INTERVAL = 1000;

/** The albums of `scope` with their stats, live (see albumQuery); `undefined` until read. */
export default function useAlbumRows(scope) {
  const { albumSortOrder } = useAppSettings();
  const query = albumQuery({ scope, assetSort: albumSortOrder });
  return useLiveQuery(query.read, query.tables, [query.descriptor], { minInterval: MIN_REREAD_INTERVAL });
}
