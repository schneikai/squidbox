import { useCallback, useEffect } from 'react';
import { Alert, View } from 'react-native';

import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import reorderUnderSort from '@/components/sortable-grid/reorderUnderSort';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import SortableAlbumList from '@/features/album-list/SortableAlbumList';
import albumFilterOptions from '@/features/album-list/actions/filter-albums-action/albumFilterOptions';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useListScrollTop from '@/hooks/useListScrollTop';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';

export default function AlbumsScreen({ navigation }) {
  const { toggleFavoriteAlbum, addAlbum, moveAlbum } = useAlbums();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useListScrollTop();
  const { sortOrder, sortFunction, sortAlbums, isSortedByLastPosted } = useSortAlbumsAction();
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions } = useFloatingBars();
  const { searchBar, query: searchText } = useSearchMode(useSearch());
  const scrollHandler = useFloatingBarScrollHandler();

  const { albums, readAt } = usePreparedAlbums({ sortFn: sortFunction, filterFn: matchFilter, searchText });

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

  // Dragging arranges the whole list, so it runs unfiltered and unsearched only.
  const reorderEnabled = activeFilter.length === 0 && !searchText.trim();

  function handleSort(order) {
    sortAlbums(order);
    listScrollTop();
  }

  // A drag under another sort makes the order on screen the custom one (reorderUnderSort).
  function handleReorder(change) {
    return reorderUnderSort(change, {
      sortOrder,
      setSortOrder: sortAlbums,
      move: (drop, sort) => moveAlbum({ ...drop, sort }),
    });
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
