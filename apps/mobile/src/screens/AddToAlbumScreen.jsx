import { useState } from 'react';
import { Alert, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import ModalCloseButton from '@/components/ModalCloseButton';
import ModalHeader, { MODAL_HEADER_HEIGHT } from '@/components/ModalHeader';
import SearchOptionsBar from '@/components/floating-bars/SearchOptionsBar';
import SortFilterModal from '@/components/floating-bars/SortFilterModal';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumList from '@/features/album-list/AlbumList';
import AlbumListItem from '@/features/album-list/AlbumListItem';
import useFilterAlbumsAction from '@/features/album-list/actions/filter-albums-action/useFilterAlbumsAction';
import useSearchAlbumsAction from '@/features/album-list/actions/search-albums-action/useSearchAlbumsAction';
import albumSortOptions from '@/features/album-list/actions/sort-albums-action/albumSortOptions';
import useSortAlbumsAction from '@/features/album-list/actions/sort-albums-action/useSortAlbumsAction';
import useAlbumList from '@/features/album-list/useAlbumList';
import usePreparedAlbums from '@/features/album-list/usePreparedAlbums';
import useAlbums from '@/features/albums-context/useAlbums';
import useSearchMode from '@/hooks/useSearchMode';
import { colors, spacing } from '@/styles/designTokens';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All Albums', icon: 'apps' },
  { key: 'starred', label: 'Starred', icon: 'star' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

export default function AddToAlbumScreen({ route, navigation }) {
  const { addAlbum, addAssetsToAlbum } = useAlbums();
  const runWithProgress = useRunWithProgress();
  const { bottom } = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const { listRef, listScrollTop } = useAlbumList();
  const { sortOrder, sortFunction, sortAlbums, isDefaultSortOrder } = useSortAlbumsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAlbumsAction({ afterFilter: listScrollTop });
  const { searchBar, query: searchText } = useSearchMode(useSearchAlbumsAction());

  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const expandProgress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const albums = usePreparedAlbums({ sortFn: sortFunction, filterFn: matchFilter, searchText, showSmartAlbums: false });

  async function handleAddAssetsToAlbum(album) {
    // On a failure the screen stays, so the user can try again.
    if (await runWithProgress((batchOptions) => addAssetsToAlbum(album, route.params.assetIds, batchOptions))) {
      navigation.goBack();
    }
  }

  function handleAddAlbum() {
    Alert.prompt('Album name', undefined, (name) => {
      if (name) addAlbum({ name });
    });
  }

  const hasActiveOptions = activeFilter.length > 0 || !isDefaultSortOrder;

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
        albums={albums}
        contentContainerStyle={{
          paddingTop: MODAL_HEADER_HEIGHT,
          paddingBottom: bottom + spacing.iconButtonSize + spacing.floatingBarBottom * 2 + 16,
        }}
        onScroll={onScroll}
        renderItem={({ album, elementWidth }) => (
          <TouchableOpacity onPress={() => handleAddAssetsToAlbum(album)}>
            <AlbumListItem album={album} elementWidth={elementWidth} />
          </TouchableOpacity>
        )}
      />

      <SearchOptionsBar
        {...searchBar}
        expandProgress={expandProgress}
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
        sortOptions={albumSortOptions}
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
