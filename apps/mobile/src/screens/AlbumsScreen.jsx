import { useCallback, useEffect } from 'react';
import { Alert, View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import AlbumListItemWithEditMode from '@/features/album-list/AlbumListItemWithEditMode';
import SortableAlbumList from '@/features/album-list/SortableAlbumList';
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
  const { sortOrder, sortFunction, sortAlbums, isDefaultSortOrder, isSortedByLastPosted } = useSortAlbumsAction({
    afterSort: listScrollTop,
  });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions } = useFloatingBars();
  const { searchBar, query: searchText } = useSearchMode(useSearchAlbumsAction());
  const scrollHandler = useFloatingBarScrollHandler();

  const { albums, readAt } = usePreparedAlbums({ sortFn: sortFunction, filterFn: matchFilter, searchText });

  // Dragging sets the albums' own order, so it runs on that order only, unfiltered: under another
  // sort a drop would have no place in the custom order (as in Photos, arranging needs Custom).
  const reorderEnabled = sortOrder === 'custom' && activeFilter.length === 0 && !searchText.trim();
  const hasActiveOptions = activeFilter.length > 0 || !isDefaultSortOrder;

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

  function handleAdd() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  useEffect(() => {
    registerScreenOptions('albums', {
      sortOrder,
      sortOptions: albumSortOptions,
      activeFilter,
      filterOptions: [
        { key: 'all', label: 'All Albums', icon: 'apps-outline' },
        { key: 'starred', label: 'Starred', icon: 'star-outline' },
        { key: 'archived', label: 'Archived', icon: 'archive-outline' },
      ],
      onSort: sortAlbums,
      onFilter: toggleFilter,
    });
  }, [sortOrder, activeFilter]);

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
        onReorder={moveAlbum}
      />
      <FloatingActionsBar search={searchBar} placeholder="Search albums…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
