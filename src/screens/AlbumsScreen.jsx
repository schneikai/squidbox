import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HeaderActions from '@/components/HeaderActions';
import ScreenHeaderWithSearch from '@/components/screen-header/ScreenHeaderWithSearch';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import AlbumListItemWithEditMode from '@/features/album-list/AlbumListItemWithEditMode';
import AddAlbumAction from '@/features/album-list/actions/add-album-action/AddAlbumAction';
import FilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/FilterAlbumsAction';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import SearchAlbumsAction from '@/features/album-list/actions/search-albums-action/SearchAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import SortAlbumsAction from '@/features/album-list/actions/sort-albums-action/SortAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import ToggleEditAlbumsAction from '@/features/album-list/actions/toggle-edit-albums-action/ToggleEditAlbumsAction';
import useToggleEditAlbumsAction from '@/features/album-list/actions/toggle-edit-albums-action/useToggleEditAlbumsAction';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAlbums from '@/features/albums-context/useAlbums';
import isAlbumEditable from '@/utils/albums/isAlbumEditable';

export default function AlbumsScreen({ route, navigation }) {
  const { albums, toggleFavoriteAlbum, setAlbumDeleted } = useAlbums();
  const [albumIds, setAlbumIds] = useState();
  const insets = useSafeAreaInsets();

  const { listRef, listScrollTop } = useAlbumList();
  const { isEditMode, toggleEditMode } = useToggleEditAlbumsAction();
  const { sortOrder, sortFunction, sortAlbums } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterSort: listScrollTop });
  const { isSearchBarVisible, toggleSearchBar, searchText, setSearchText } = useSearchAlbumsAction();

  useEffect(() => {
    const albumIds = prepareAlbums({
      albums: Object.values(albums),
      sortFn: sortFunction,
      filterFn: matchFilter,
      showArchivedAlbums: activeFilter.includes('archived'),
      searchText,
    }).map((album) => album.id);
    setAlbumIds(albumIds);
  }, [albums, sortOrder, activeFilter, searchText]);

  function navigateToAlbumScreen(album) {
    navigation.navigate('AlbumScreen', { albumId: album.id });
  }

  function handleSetAlbumDeleted(album) {
    // TODO: Until there is no way to restore deleted albums, I
    // added a confirmation prompt to prevent accidental deletion.
    Alert.alert('Delete Album', 'Are you sure you want to delete this album? Images will not be deleted.', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setAlbumDeleted(album);
        },
      },
    ]);
  }

  return (
    <AlbumList
      listRef={listRef}
      albumIds={albumIds}
      renderItem={({ album, thumbnailAsset, numberOfAssets, elementWidth }) => (
        <AlbumListItemWithEditMode
          isEditMode={isEditMode}
          isEditable={isAlbumEditable(album)}
          singleTap={() => navigateToAlbumScreen(album)}
          doubleTap={() => toggleFavoriteAlbum(album)}
          onPressDelete={() => handleSetAlbumDeleted(album)}
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
      ListHeaderComponent={
        <ScreenHeaderWithSearch
          label="Albums"
          insets={insets}
          isSearchBarVisible={isSearchBarVisible}
          searchText={searchText}
          setSearchText={setSearchText}
          toggleSearchBar={toggleSearchBar}
        >
          <HeaderActions>
            <AddAlbumAction />
            <ToggleEditAlbumsAction isEditMode={isEditMode} onPress={toggleEditMode} />
            <SearchAlbumsAction isSearchBarVisible={isSearchBarVisible} onPress={toggleSearchBar} />
            <SortAlbumsAction sortOrder={sortOrder} onPress={sortAlbums} />
            <FilterAlbumsAction activeFilter={activeFilter} onPress={toggleFilter} />
          </HeaderActions>
        </ScreenHeaderWithSearch>
      }
    />
  );
}
