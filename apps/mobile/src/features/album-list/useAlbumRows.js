import albumQuery from '@/features/album-list/albumQuery';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The albums of `scope` with their stats, live (see albumQuery); `undefined` until read. */
export default function useAlbumRows(scope) {
  const { albumSortOrder } = useAppSettings();
  const query = albumQuery({ scope, assetSort: albumSortOrder });
  return useLiveQuery(query.read, query.tables, [query.descriptor]);
}
