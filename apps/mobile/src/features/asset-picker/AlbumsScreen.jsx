import { TouchableOpacity } from 'react-native';

import PickerHeader from '@/components/PickerHeader';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import FilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/FilterAlbumsAction';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import SortAlbumsAction from '@/features/album-list/actions/sort-albums-action/SortAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import albumQuery from '@/features/album-list/albumQuery';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAppSettings from '@/features/app-settings/useAppSettings';
import { useLiveQuery } from '@/sync/useLiveQuery';

export default function AlbumsScreen({ navigation }) {
  const { albumSortOrder } = useAppSettings();
  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterSort: listScrollTop });
  const { searchText } = useSearchAlbumsAction();

  const query = albumQuery({ scope: 'all', assetSort: albumSortOrder });
  const rows = useLiveQuery(query.page, query.tables, [query.descriptor]);
  const albums = prepareAlbums({ albums: rows ?? [], sortFn: sortFunction, filterFn: matchFilter, searchText });

  return (
    <AlbumList
      listRef={listRef}
      albums={albums}
      renderItem={({ album, elementWidth }) => (
        <TouchableOpacity onPress={() => navigation.navigate('Album', { albumId: album.id })}>
          <AlbumListItem album={album} elementWidth={elementWidth} />
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <PickerHeader label="Albums">
          <SortAlbumsAction sortOrder={sortOrder} onPress={sortAlbums} />
          <FilterAlbumsAction activeFilter={activeFilter} onPress={toggleFilter} />
        </PickerHeader>
      }
    />
  );
}
