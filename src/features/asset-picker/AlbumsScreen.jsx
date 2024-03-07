import { useState, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';

import HeaderActions from '@/components/HeaderActions';
import ScreenHeaderWithSearch from '@/components/screen-header/ScreenHeaderWithSearch';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import FilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/FilterAlbumsAction';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import SearchAlbumsAction from '@/features/album-list/actions/search-albums-action/SearchAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import SortAlbumsAction from '@/features/album-list/actions/sort-albums-action/SortAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAlbums from '@/features/albums-context/useAlbums';

export default function AlbumsScreen({ navigation }) {
  const { albums } = useAlbums();
  const [albumIds, setAlbumIds] = useState();

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterSort: listScrollTop });
  const { isSearchBarVisible, toggleSearchBar, searchText, setSearchText } = useSearchAlbumsAction();

  useEffect(() => {
    const albumIds = prepareAlbums({
      albums: Object.values(albums),
      sortFn: sortFunction,
      filterFn: matchFilter,
      searchText,
    }).map((album) => album.id);
    setAlbumIds(albumIds);
  }, [albums, sortOrder, activeFilter, searchText]);

  return (
    <AlbumList
      listRef={listRef}
      albumIds={albumIds}
      renderItem={({ album, thumbnailAsset, numberOfAssets, elementWidth }) => (
        <TouchableOpacity onPress={() => navigation.navigate('Album', { albumId: album.id })}>
          <AlbumListItem
            album={album}
            thumbnailAsset={thumbnailAsset}
            numberOfAssets={numberOfAssets}
            elementWidth={elementWidth}
          />
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <ScreenHeaderWithSearch
          label="Albums"
          isSearchBarVisible={isSearchBarVisible}
          searchText={searchText}
          setSearchText={setSearchText}
          toggleSearchBar={toggleSearchBar}
        >
          <HeaderActions>
            <SearchAlbumsAction isSearchBarVisible={isSearchBarVisible} onPress={toggleSearchBar} />
            <SortAlbumsAction sortOrder={sortOrder} onPress={sortAlbums} />
            <FilterAlbumsAction activeFilter={activeFilter} onPress={toggleFilter} />
          </HeaderActions>
        </ScreenHeaderWithSearch>
      }
    />
  );
}
