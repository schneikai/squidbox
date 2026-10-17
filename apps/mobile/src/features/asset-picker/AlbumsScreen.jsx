import { TouchableOpacity } from 'react-native';

import PickerHeader from '@/components/PickerHeader';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import FilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/FilterAlbumsAction';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import SortAlbumsAction from '@/features/album-list/actions/sort-albums-action/SortAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import useAlbumList from '@/features/album-list/useAlbumList';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';

export default function AlbumsScreen({ navigation }) {
  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction({
    afterSort: listScrollTop,
  });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });
  const { searchText } = useSearchAlbumsAction();

  const { albums } = usePreparedAlbums({ sortFn: sortFunction, filterFn: matchFilter, searchText });

  return (
    <AlbumList
      listRef={listRef}
      albums={albums}
      renderItem={({ album, elementWidth }) => (
        <TouchableOpacity onPress={() => navigation.navigate('Album', { albumId: album.id })}>
          <AlbumListItem album={album} elementWidth={elementWidth} showLastPostedAt={isSortedByLastPosted} />
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
