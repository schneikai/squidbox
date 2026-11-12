import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
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
import { ALBUM_SEARCH_PLACEHOLDER } from '@/features/album-list/albumSearchPlaceholder';
import type { AlbumFilter } from '@/features/album-list/prepareAlbums';
import starredAlbums from '@/features/album-list/starredAlbums';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import useScrollY from '@/hooks/useScrollY';
import { layout } from '@/styles/designTokens';
import isBlank from '@/utils/isBlank';
import pluralizeText from '@/utils/pluralizeText';

// The Albums tab: the starred albums first as a row of small covers, the last starred first (none starred, no row), then every
// album in a grid, searched, sorted and filtered in the floating bar. Double-tap stars an album, + adds one.
export default function AlbumsScreen() {
  const { toggleFavoriteAlbum, moveAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { sortOrder, sortAlbums } = useSortAlbumsAction();
  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls<AlbumSort, AlbumFilter>({
    onSort: sortAlbums,
  });

  const { onScroll: scrollHandler, scrollY } = useScrollY();

  const { albums, rows, readAt } = usePreparedAlbums({ sortOrder, activeFilter, searchText });
  // Searching or filtering shows only the grid.
  const isNarrowed = activeFilter.length > 0 || !isBlank(searchText);
  const starred = useMemo(() => (isNarrowed ? [] : starredAlbums(rows ?? [])), [isNarrowed, rows]);

  const renderItem = useCallback<AlbumListProps['renderItem']>(
    ({ album, elementWidth }) => (
      <SuperPressable
        onPress={() => router.navigate(`/album/${album.id}`)}
        onDoublePress={() => toggleFavoriteAlbum(album)}
      >
        <AlbumListItem album={album} elementWidth={elementWidth} />
      </SuperPressable>
    ),
    [toggleFavoriteAlbum],
  );

  // Dragging arranges the whole list, so it runs unfiltered and unsearched only.
  const reorderEnabled = !isNarrowed;

  // A drag under another sort makes the order on screen the custom one (reorderUnderSort).
  function handleReorder(change: ReorderChange) {
    return reorderUnderSort<AlbumSort, number>(change, {
      sortOrder,
      setSortOrder: sortAlbums,
      move: (drop, sort) => moveAlbum({ ...drop, sort }),
    });
  }

  // The same element while its inputs are, so the grid doesn't re-measure it on every render.
  const header = useMemo(
    () =>
      starred.length ? (
        <View style={styles.header}>
          <ScreenSectionHeader title="Starred" size="small" isFirst />
          <StarredAlbumRow albums={starred} />
          <ScreenSectionHeader
            title={pluralizeText('1 album', `${albums.length.toLocaleString()} albums`, albums.length)}
            size="small"
          />
        </View>
      ) : undefined,
    [starred, albums.length],
  );

  return (
    <View testID="albums-screen" style={{ flex: 1 }}>
      <FloatingHeader title="Albums" scrollY={scrollY} onAdd={promptAddAlbum} />
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
        placeholder={ALBUM_SEARCH_PLACEHOLDER}
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

const styles = StyleSheet.create({
  // The grid has no side padding of its own: its cells are inset by its gap, the gutter.
  header: {
    paddingHorizontal: layout.sideGutter,
  },
});
