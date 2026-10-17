import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQueryState } from '@/sync/useLiveQuery';

// The stats re-read is slow (a few hundred ms): during a write burst (a pull, a bulk action, a
// backup) re-read at most about once a second.
const MIN_REREAD_INTERVAL = 1000;

/** The albums of `scope` with their stats, live (albumQuery): `rows` (`undefined` until read) and their `readAt`. */
export default function useAlbumRows(scope) {
  const { albumSortOrder } = useAppSettings();
  const query = albumQuery({ scope, assetSort: albumSortOrder });
  const { data, readAt } = useLiveQueryState(query.read, query.tables, [query.descriptor], {
    minInterval: MIN_REREAD_INTERVAL,
  });
  return { rows: data, readAt };
}
