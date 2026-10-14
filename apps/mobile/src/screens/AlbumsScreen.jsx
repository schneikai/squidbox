import { useEffect } from 'react';
import { Alert, View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import AlbumListItemWithEditMode from '@/features/album-list/AlbumListItemWithEditMode';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import albumQuery from '@/features/album-list/albumQuery';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearchMode from '@/hooks/useSearchMode';
import { useLiveQuery } from '@/sync/useLiveQuery';

export default function AlbumsScreen({ navigation }) {
  const { toggleFavoriteAlbum, addAlbum } = useAlbums();
  const { albumSortOrder } = useAppSettings();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums, isDefaultSortOrder } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions } = useFloatingBars();
  const { searchBar, query: searchText } = useSearchMode(useSearchAlbumsAction());
  const scrollHandler = useFloatingBarScrollHandler();

  const query = albumQuery({ scope: 'all', assetSort: albumSortOrder });
  const rows = useLiveQuery(query.page, query.tables, [query.descriptor]);
  const albums = prepareAlbums({
    albums: rows ?? [],
    sortFn: sortFunction,
    filterFn: matchFilter,
    showArchivedAlbums: activeFilter.includes('archived'),
    searchText,
  });

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

  const hasActiveOptions = activeFilter.length > 0 || !isDefaultSortOrder;

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader title="Albums" onAdd={handleAdd} />
      <AlbumList
        listRef={listRef}
        albums={albums}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={scrollHandler}
        renderItem={({ album, elementWidth }) => (
          <AlbumListItemWithEditMode
            isEditMode={false}
            singleTap={() => navigation.navigate('AlbumScreen', { albumId: album.id })}
            doubleTap={() => toggleFavoriteAlbum(album)}
          >
            <AlbumListItem
              album={album}
              elementWidth={elementWidth}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </AlbumListItemWithEditMode>
        )}
      />
      <FloatingActionsBar search={searchBar} placeholder="Search albums…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
