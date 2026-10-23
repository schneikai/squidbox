import { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchSortFilterBar, { SEARCH_SORT_FILTER_BAR_CLEARANCE } from '@/components/floating-bars/SearchSortFilterBar';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import useAlbumList from '@/features/album-list/useAlbumList';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useSearchMode from '@/hooks/useSearchMode';
import isDeletedAssetsAlbum from '@/utils/albums/isDeletedAssetsAlbum';

// The albums of a modal to pick one from, with search, sort and filter; a tap hands the album to
// `onPick`. Smart albums show with `showSmartAlbums` (to pick assets from Favorites, not to add to
// it), but never Deleted: nothing is picked from the trash. `onScroll` and `expandProgress` let the
// modal animate its header and a segment pill.
export default function AlbumPicker({ onPick, showSmartAlbums = false, paddingTop, onScroll, expandProgress }) {
  const { bottom } = useSafeAreaInsets();

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction({
    afterSort: listScrollTop,
  });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });
  const { searchBar, query: searchText } = useSearchMode(useSearchAlbumsAction());
  const matchPickable = useCallback((album) => !isDeletedAssetsAlbum(album) && matchFilter(album), [matchFilter]);

  const { albums } = usePreparedAlbums({
    sortFn: sortFunction,
    filterFn: matchPickable,
    searchText,
    showSmartAlbums,
  });

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
        onSort={sortAlbums}
        onFilter={toggleFilter}
      />
    </>
  );
}
