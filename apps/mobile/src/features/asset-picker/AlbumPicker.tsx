import { Pressable } from 'react-native';
import type { ScrollHandlerProcessed, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import type { AlbumSort } from '@/features/album-list/actions/sort-albums-action/isAlbumSort';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import type { AlbumFilter } from '@/features/album-list/prepareAlbums';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useListControls from '@/hooks/useListControls';
import { layout, press } from '@/styles/designTokens';

type AlbumPickerProps = {
  onPick: (album: AlbumListRow) => void;
  onScroll?: ScrollHandlerProcessed;
  expandProgress?: SharedValue<number>;
};

// The photo picker's albums to pick one from, with search, sort and filter; a tap hands the album to
// `onPick`. Smart albums show (to pick assets from Favorites), but never Deleted: nothing is picked
// from the trash. `onScroll` and `expandProgress` let the modal animate its header and a segment pill.
export default function AlbumPicker({ onPick, onScroll, expandProgress }: AlbumPickerProps) {
  const { bottom } = useSafeAreaInsets();

  const { sortOrder, sortAlbums } = useSortAlbumsAction();
  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls<AlbumSort, AlbumFilter>({
    onSort: sortAlbums,
  });
  const { albums } = usePreparedAlbums({ sortOrder, activeFilter, searchText, showDeleted: false });

  return (
    <>
      <AlbumList
        listRef={listRef}
        albums={albums}
        contentContainerStyle={{
          paddingTop: layout.sheetContentTop,
          paddingBottom: bottom + layout.barClearance,
        }}
        onScroll={onScroll}
        renderItem={({ album, elementWidth }) => (
          <Pressable style={({ pressed }) => pressed && press.flat} onPress={() => onPick(album)}>
            <AlbumListItem album={album} elementWidth={elementWidth} />
          </Pressable>
        )}
      />
      <SearchSortFilterBar
        search={searchBar}
        expandProgress={expandProgress}
        placeholder="Search albums, notes and contacts…"
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
