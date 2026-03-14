import { useEffect, useMemo } from 'react';
import { Alert } from 'react-native';

import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import AlbumListItemWithEditMode from '@/features/album-list/AlbumListItemWithEditMode';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAlbums from '@/features/albums-context/useAlbums';
import useScreenPadding from '@/hooks/useScreenPadding';

export default function AlbumsScreen({ navigation }) {
  const { albums, toggleFavoriteAlbum, addAlbum } = useAlbums();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions, screenOptionsRef, onScrollUpdate, searchText } = useFloatingBars();

  const albumIds = useMemo(
    () =>
      prepareAlbums({
        albums: Object.values(albums),
        sortFn: sortFunction,
        filterFn: matchFilter,
        showArchivedAlbums: activeFilter.includes('archived'),
        searchText,
      }).map((album) => album.id),
    [albums, sortFunction, matchFilter, activeFilter, searchText],
  );

  function handleAdd() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  useEffect(() => {
    registerScreenOptions('albums', {
      sortOrder,
      activeFilter,
      filterOptions: [
        { key: 'all', label: 'All Albums', icon: 'apps-outline' },
        { key: 'starred', label: 'Starred', icon: 'star-outline' },
        { key: 'archived', label: 'Archived', icon: 'archive-outline' },
      ],
      onSort: sortAlbums,
      onFilter: toggleFilter,
      onAdd: handleAdd,
    });
    screenOptionsRef.current._activeTab = 'albums';
  }, [sortOrder, activeFilter]);

  function handleScroll(event) {
    onScrollUpdate(event.nativeEvent.contentOffset.y);
  }

  return (
    <AlbumList
      listRef={listRef}
      albumIds={albumIds}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      onScroll={handleScroll}
      renderItem={({ album, thumbnailAsset, numberOfAssets, elementWidth }) => (
        <AlbumListItemWithEditMode
          isEditMode={false}
          singleTap={() => navigation.navigate('AlbumScreen', { albumId: album.id })}
          doubleTap={() => toggleFavoriteAlbum(album)}
        >
          <AlbumListItem
            album={album}
            thumbnailAsset={thumbnailAsset}
            numberOfAssets={numberOfAssets}
            elementWidth={elementWidth}
            showLastPostedAt={sortOrder.includes('lastPostedAt')}
          />
        </AlbumListItemWithEditMode>
      )}
    />
  );
}
