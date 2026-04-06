import Icon from '@/components/Icon';
import { useMemo, useState } from 'react';
import { Alert, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientButton from '@/components/GradientButton';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import SearchOptionsBar from '@/components/floating-bars/SearchOptionsBar';
import SortFilterModal from '@/components/floating-bars/SortFilterModal';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import prepareAlbums from '@/features/album-list/prepareAlbums';
import useAlbumList from '@/features/album-list/useAlbumList';
import useAlbums from '@/features/albums-context/useAlbums';
import { colors, spacing } from '@/styles/designTokens';

const FILTER_OPTIONS = [
  { key: 'all',      label: 'All Albums', icon: 'apps' },
  { key: 'starred',  label: 'Starred',    icon: 'star' },
  { key: 'archived', label: 'Archived',   icon: 'archive' },
];

const SORT_OPTIONS = [
  { key: 'name',         label: 'Name' },
  { key: 'createdAt',    label: 'Created At' },
  { key: 'lastPostedAt', label: 'Last Posted At' },
];

export default function AddToAlbumScreen({ route, navigation }) {
  const { albums, addAlbum, addAssetsToAlbum } = useAlbums();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterSort: listScrollTop });
  const { searchText, setSearchText } = useSearchAlbumsAction();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const expandProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  function openSearch() { setIsSearchActive(true); }
  function closeSearch() { setIsSearchActive(false); setSearchText(''); }

  const albumIds = useMemo(
    () =>
      prepareAlbums({
        albums: Object.values(albums),
        sortFn: sortFunction,
        filterFn: matchFilter,
        searchText,
        showSmartAlbums: false,
      }).map((album) => album.id),
    [albums, sortFunction, matchFilter, activeFilter, searchText],
  );

  function handleAddAssetsToAlbum(album) {
    addAssetsToAlbum(album, route.params.assetIds);
    navigation.goBack();
  }

  function handleAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  const hasActiveOptions = activeFilter.length > 0 || !sortOrder.startsWith('createdAt');

  return (
    <View style={{ flex: 1 }}>
      <ModalHeader
        leftSlot={<ModalCloseButton onPress={() => navigation.goBack()} />}
        centerSlot="Add to Album"
        scrollY={scrollY}
        rightSlot={
          <GradientButton onPress={handleAddAlbum}>
            <Icon name="add" color={colors.textInverse} />
          </GradientButton>
        }
      />

      <AlbumList
        listRef={listRef}
        albumIds={albumIds}
        contentContainerStyle={{ paddingTop: MODAL_HEADER_HEIGHT, paddingBottom: bottom + spacing.iconButtonSize + spacing.floatingBarBottom * 2 + 16 }}
        onScroll={onScroll}
        renderItem={({ album, thumbnailAsset, numberOfAssets, elementWidth }) => (
          <TouchableOpacity onPress={() => handleAddAssetsToAlbum(album)}>
            <AlbumListItem
              album={album}
              thumbnailAsset={thumbnailAsset}
              numberOfAssets={numberOfAssets}
              elementWidth={elementWidth}
            />
          </TouchableOpacity>
        )}
      />

      <SearchOptionsBar
        expandProgress={expandProgress}
        isSearchActive={isSearchActive}
        searchText={searchText}
        onOpenSearch={openSearch}
        onCloseSearch={closeSearch}
        onChangeSearch={setSearchText}
        onOpenOptions={() => setIsSortFilterOpen(true)}
        hasActiveState={hasActiveOptions}
        placeholder="Search albums…"
        bottom={bottom + spacing.floatingBarBottom}
        left={spacing.floatingBarSide}
        maxWidth={screenWidth - spacing.floatingBarSide * 2}
      />

      <SortFilterModal
        visible={isSortFilterOpen}
        onClose={() => setIsSortFilterOpen(false)}
        sortOrder={sortOrder}
        sortOptions={SORT_OPTIONS}
        activeFilter={activeFilter}
        filterOptions={FILTER_OPTIONS}
        onSort={sortAlbums}
        onFilter={toggleFilter}
        bottom={bottom + spacing.floatingBarBottom + spacing.iconButtonSize + spacing.popoverGap}
        left={spacing.floatingBarSide}
      />
    </View>
  );
}
