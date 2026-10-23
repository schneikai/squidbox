import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchSortFilterBar, { SEARCH_SORT_FILTER_BAR_CLEARANCE } from '@/components/floating-bars/SearchSortFilterBar';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useListControls from '@/hooks/useListControls';

// The albums of a modal to pick one from, with search, sort and filter; a tap hands the album to
// `onPick`. Smart albums show with `showSmartAlbums` (to pick assets from Favorites, not to add to
// it), but never Deleted: nothing is picked from the trash. `onScroll` and `expandProgress` let the
// modal animate its header and a segment pill.
export default function AlbumPicker({ onPick, showSmartAlbums = false, paddingTop, onScroll, expandProgress }) {
  const { bottom } = useSafeAreaInsets();

  const { sortOrder, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction();
  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls({ onSort: sortAlbums });
  const { albums } = usePreparedAlbums({ sortOrder, activeFilter, searchText, showSmartAlbums, showDeleted: false });

  return (
    <>
      <AlbumList
        listRef={listRef}
        albums={albums}
        contentContainerStyle={{
          paddingTop,
          paddingBottom: bottom + SEARCH_SORT_FILTER_BAR_CLEARANCE,
        }}
        onScroll={onScroll}
        renderItem={({ album, elementWidth }) => (
          <TouchableOpacity onPress={() => onPick(album)}>
            <AlbumListItem album={album} elementWidth={elementWidth} showLastPostedAt={isSortedByLastPosted} />
          </TouchableOpacity>
        )}
      />
      <SearchSortFilterBar
        search={searchBar}
        expandProgress={expandProgress}
        placeholder="Search albums…"
        sortOrder={sortOrder}
        sortOptions={albumSortOptions}
        activeFilter={activeFilter}
        filterOptions={albumFilterOptions}
        onSort={sort}
        onFilter={toggleFilter}
      />
    </>
  );
}
