import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import reorderUnderSort from '@/components/sortable-grid/reorderUnderSort';
import type { ReorderChange } from '@/components/sortable-grid/useDragReorder';
import type { AlbumListProps } from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import SortableAlbumList from '@/features/album-list/SortableAlbumList';
import StarredAlbumRow from '@/features/album-list/StarredAlbumRow';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import type { AlbumSort } from '@/features/album-list/actions/sort-albums-action/isAlbumSort';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import type { AlbumListRow } from '@/features/album-list/albumQuery';
import prepareAlbums, { type AlbumFilter } from '@/features/album-list/prepareAlbums';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { layout } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

// The Albums tab: the starred albums first as a row of small covers, the last starred first (none starred, no row), then every
// album in a grid, searched, sorted and filtered in the floating bar. Double-tap stars an album, + adds one.
export default function AlbumsScreen() {
  const { toggleFavoriteAlbum, moveAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { sortOrder, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction();
  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls<AlbumSort, AlbumFilter>({
    onSort: sortAlbums,
  });

  const scrollHandler = useFloatingBarScrollHandler();

  const { albums, rows, readAt } = usePreparedAlbums({ sortOrder, activeFilter, searchText });
  // The last starred first, whatever the grid's sort (those starred before that was recorded after them,
  // newest first); archived ones stay out, as they do in the grid. Searching or filtering shows only the grid.
  const isNarrowed = activeFilter.length > 0 || !!searchText.trim();
  const starred = useMemo(
    () =>
      isNarrowed
        ? []
        : prepareAlbums({
            albums: rows ?? [],
            sortOrder: 'createdAt:desc',
            activeFilter: ['starred'],
            searchText: '',
          }).sort(byLastStarred),
    [isNarrowed, rows],
  );

  const renderItem = useCallback<AlbumListProps['renderItem']>(
    ({ album, elementWidth }) => (
      <SuperPressable
        onPress={() => router.navigate(`/album/${album.id}`)}
        onDoublePress={() => toggleFavoriteAlbum(album)}
      >
        <AlbumListItem album={album} elementWidth={elementWidth} showLastPostedAt={isSortedByLastPosted} />
      </SuperPressable>
    ),
    [toggleFavoriteAlbum, isSortedByLastPosted],
  );

  // Dragging arranges the whole list, so it runs unfiltered and unsearched only.
  const reorderEnabled = activeFilter.length === 0 && !searchText.trim();

  // A drag under another sort makes the order on screen the custom one (reorderUnderSort).
  function handleReorder(change: ReorderChange) {
    return reorderUnderSort<AlbumSort, number>(change, {
      sortOrder,
      setSortOrder: sortAlbums,
      move: (drop, sort) => moveAlbum({ ...drop, sort }),
    });
  }

  const header = starred.length ? (
    <View style={styles.header}>
      <ScreenSectionHeader title="Starred" size="small" isFirst />
      <StarredAlbumRow albums={starred} />
      <ScreenSectionHeader
        title={pluralizeText('1 album', `${albums.length.toLocaleString()} albums`, albums.length)}
        size="small"
      />
    </View>
  ) : undefined;

  return (
    <View testID="albums-screen" style={{ flex: 1 }}>
      <FloatingHeader title="Albums" onAdd={promptAddAlbum} />
      <SortableAlbumList
        listRef={listRef}
        albums={albums}
        rowsReadAt={readAt}
        header={header}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        onScroll={scrollHandler}
        renderItem={renderItem}
        reorderEnabled={reorderEnabled}
        onReorder={handleReorder}
      />
      <FloatingActionsBar
        search={searchBar}
        placeholder="Search albums…"
        sortOrder={sortOrder}
        sortOptions={albumSortOptions}
        activeFilter={activeFilter}
        filterOptions={albumFilterOptions}
        onSort={sort}
        onFilter={toggleFilter}
      />
    </View>
  );
}

// The last starred first; a stable sort keeps the rest (starred before favoritedAt) in their order.
function byLastStarred(a: AlbumListRow, b: AlbumListRow) {
  return (b.favoritedAt ?? 0) - (a.favoritedAt ?? 0);
}

const styles = StyleSheet.create({
  // The grid has no side padding of its own: its cells are inset by its gap, the gutter.
  header: {
    paddingHorizontal: layout.sideGutter,
  },
});
