import { useCallback } from 'react';
import { View } from 'react-native';

import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import reorderUnderSort from '@/components/sortable-grid/reorderUnderSort';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import SortableAlbumList from '@/features/album-list/SortableAlbumList';
import useAddAlbumAction from '@/features/album-list/actions/add-album-action/useAddAlbumAction';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';

export default function AlbumsScreen({ navigation }) {
  const { toggleFavoriteAlbum, moveAlbum } = useAlbums();
  const promptAddAlbum = useAddAlbumAction();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { sortOrder, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction();
  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls({ onSort: sortAlbums });

  const scrollHandler = useFloatingBarScrollHandler();

  const { albums, readAt } = usePreparedAlbums({ sortOrder, activeFilter, searchText });

  const renderItem = useCallback(
    ({ album, elementWidth }) => (
      <SuperPressable
        onPress={() => navigation.navigate('AlbumScreen', { albumId: album.id })}
        onDoublePress={() => toggleFavoriteAlbum(album)}
      >
        <AlbumListItem album={album} elementWidth={elementWidth} showLastPostedAt={isSortedByLastPosted} />
      </SuperPressable>
    ),
    [navigation, toggleFavoriteAlbum, isSortedByLastPosted],
  );

  // Dragging arranges the whole list, so it runs unfiltered and unsearched only.
  const reorderEnabled = activeFilter.length === 0 && !searchText.trim();

  // A drag under another sort makes the order on screen the custom one (reorderUnderSort).
  function handleReorder(change) {
    return reorderUnderSort(change, {
      sortOrder,
      setSortOrder: sortAlbums,
      move: (drop, sort) => moveAlbum({ ...drop, sort }),
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader title="Albums" onAdd={promptAddAlbum} />
      <SortableAlbumList
        listRef={listRef}
        albums={albums}
        rowsReadAt={readAt}
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
