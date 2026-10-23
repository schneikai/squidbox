import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import AlbumListItemWithEditMode from '@/features/album-list/AlbumListItemWithEditMode';
import SortableAlbumList from '@/features/album-list/SortableAlbumList';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import useAlbumList from '@/features/album-list/useAlbumList';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearchMode from '@/hooks/useSearchMode';

export default function AlbumsScreen({ navigation }) {
  const { toggleFavoriteAlbum, addAlbum, moveAlbum } = useAlbums();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction();
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions } = useFloatingBars();
  const { searchBar, query: searchText } = useSearchMode(useSearchAlbumsAction());
  const scrollHandler = useFloatingBarScrollHandler();

  const { albums, readAt } = usePreparedAlbums({ sortFn: sortFunction, filterFn: matchFilter, searchText });
  // The drop's write count while a drag under another sort waits to switch to Custom (see below).
  const [customFrom, setCustomFrom] = useState(null);

  const renderItem = useCallback(
    ({ album, elementWidth }) => (
      <AlbumListItemWithEditMode
        isEditMode={false}
        singleTap={() => navigation.navigate('AlbumScreen', { albumId: album.id })}
        doubleTap={() => toggleFavoriteAlbum(album)}
      >
        <AlbumListItem album={album} elementWidth={elementWidth} showLastPostedAt={isSortedByLastPosted} />
      </AlbumListItemWithEditMode>
    ),
    [navigation, toggleFavoriteAlbum, isSortedByLastPosted],
  );

  useEffect(() => {
    registerScreenOptions('albums', {
      sortOrder,
      sortOptions: albumSortOptions,
      activeFilter,
      filterOptions: albumFilterOptions,
      onSort: handleSort,
      onFilter: toggleFilter,
    });
  }, [sortOrder, activeFilter]);

  // A drag under another sort makes the order on screen the custom one and switches to Custom. The
  // switch waits for the rows that hold that order (read at or after the drop's write), so the list
  // never shows the old custom order in between. It happens during render, so React re-renders
  // sorted by Custom before the stale order paints; sortAlbums must stay a plain state change for
  // that (no afterSort here).
  if (customFrom !== null && readAt >= customFrom) {
    setCustomFrom(null);
    sortAlbums('custom');
  }

  // Dragging arranges the whole list, so it runs unfiltered and unsearched only.
  const reorderEnabled = activeFilter.length === 0 && !searchText.trim();

  function handleSort(order) {
    setCustomFrom(null);
    sortAlbums(order);
    listScrollTop();
  }

  async function handleReorder(change) {
    // The custom order already holds the screen's once an earlier drop's switch is pending.
    if (sortOrder === 'custom' || customFrom !== null) return moveAlbum(change);
    const writtenAt = await moveAlbum({ ...change, order: albums.map((album) => album.id) });
    setCustomFrom(writtenAt);
    return writtenAt;
  }

  function handleAdd() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader title="Albums" onAdd={handleAdd} />
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
      <FloatingActionsBar search={searchBar} placeholder="Search albums…" activeFilter={activeFilter} />
    </View>
  );
}
