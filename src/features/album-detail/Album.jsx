import { useActionSheet } from '@expo/react-native-action-sheet';
import { useNavigation } from '@react-navigation/native';
import { useState, useMemo } from 'react';
import { Text, StyleSheet, View, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import SearchOptionsBar from '@/components/floating-bars/SearchOptionsBar';
import SortFilterModal from '@/components/floating-bars/SortFilterModal';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import AlbumAssetsView from '@/features/album-detail/AlbumAssetsView';
import AlbumPostsView from '@/features/album-detail/AlbumPostsView';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import { assetSortOptions } from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';
import preparePosts from '@/features/post-list/preparePosts';
import usePosts from '@/features/posts-context/usePosts';
import useScreenPadding from '@/hooks/useScreenPadding';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, scale, spacing, typography } from '@/styles/designTokens';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import pluralizeText from '@/utils/pluralizeText';

const TABS = [
  { key: 'Assets', icon: 'grid' },
  { key: 'Posts', icon: 'share-alt' },
];

const ASSET_FILTER_OPTIONS = [
  { key: 'all', label: 'All Media', icon: 'apps' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'images', label: 'Photos', icon: 'image' },
  { key: 'videos', label: 'Videos', icon: 'video' },
];

const ASSET_SORT_OPTIONS = [
  { key: 'custom', label: 'Custom', directional: false },
  { key: 'createdAt', label: 'Created At' },
  { key: 'lastPostedAt', label: 'Last Posted At' },
];

export default function Album({ album }) {
  const { assets, toggleFavoriteAsset, setAssetsDeleted } = useAssets();
  const { removeAssetsFromAlbum, reorderAlbumAssets, updateAlbum } = useAlbums();
  const { albumSortOrder, setAlbumSortOrder } = useAppSettings();
  const { posts } = usePosts();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { showActionSheetWithOptions } = useActionSheet();

  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  const { listRef, listScrollTop } = useAssetList();
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset, selectAssets } =
    useToggleSelectAssetsAction();
  // Sort resolution: an album on custom order shows its own manual order; every
  // other album follows the shared global sort. A per-session override lets the
  // active album react immediately to sort/reorder changes.
  const [sessionSortOrder, setSessionSortOrder] = useState(null);
  const sortOrder = sessionSortOrder ?? (album.sortOrder === 'custom' ? 'custom' : albumSortOrder);
  const sortFunction = assetSortOptions[sortOrder] ?? assetSortOptions['createdAt:desc'];
  const { activeFilter, matchFilter, toggleFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();
  const [activeTab, setActiveTab] = useState('Assets');
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const expandProgress = useSharedValue(0);

  function openSearch() {
    setIsSearchActive(true);
  }
  function closeSearch() {
    setIsSearchActive(false);
    setSearchText('');
  }

  const assetIds = useMemo(
    () =>
      prepareAssets({
        assets: getAlbumAssets(album, assets),
        sortFn: sortFunction,
        filterFn: matchFilter,
        searchText,
      }).map((asset) => asset.id),
    [album, assets, sortFunction, matchFilter, searchText],
  );

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        albums: { [album.id]: album },
        searchText: `album:${album.id}`,
        sortFn: (a, b) => b.postedAt - a.postedAt,
      }).map((post) => post.id),
    [posts, album],
  );

  const hasSelection = selectedAssetIds.length > 0;
  const hasSubHeader = !!album.archivedAt || !!album.notes;

  // Drag-to-reorder only makes sense on the full, unfiltered album order and has
  // nowhere to persist for smart albums, so it stays off otherwise.
  const reorderEnabled =
    activeTab === 'Assets' && !isSelectMode && !isSmartAlbum(album) && activeFilter.length === 0 && !searchText.trim();

  // Smart albums (Favorites/Deleted) have no stored order, so hide "Custom".
  const sortOptions = isSmartAlbum(album)
    ? ASSET_SORT_OPTIONS.filter((option) => option.key !== 'custom')
    : ASSET_SORT_OPTIONS;

  function handleSort(order) {
    if (order === 'custom') {
      // Custom is per-album: flag this album and leave the global sort alone.
      updateAlbum(album.id, { sortOrder: 'custom' });
    } else {
      // Any date sort becomes the shared default and takes this album off custom
      // (the manual order data in album.assets is kept for later).
      setAlbumSortOrder(order);
      updateAlbum(album.id, { sortOrder: null });
    }
    setSessionSortOrder(order);
    listScrollTop();
  }

  function handleReorder(newVisibleOrder) {
    // Preserve any ids not in the visible set (deleted / duplicated) by appending
    // them after the new order, deduped. reorderAlbumAssets also flags the album
    // as custom-sorted.
    const merged = [...new Set([...newVisibleOrder, ...album.assets])];
    reorderAlbumAssets(album, merged);
    // Reflect the manual order immediately without the usual scroll-to-top.
    setSessionSortOrder('custom');
  }

  const headerSubtitle =
    activeTab === 'Posts'
      ? pluralizeText('1 Post', '%{count} Posts', postIds.length)
      : pluralizeText('1 Asset', '%{count} Assets', assetIds.length);

  function getSelectedAssets() {
    const ids = selectedAssetIds.length > 0 ? selectedAssetIds : assetIds;
    return Object.values(assets).filter((a) => ids.includes(a.id));
  }

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    }
  }

  async function handleDownload() {
    await saveAssetsToMediaLibraryAsync(getSelectedAssets());
  }

  function handleSelectAll() {
    selectAssets(selectedAssetIds.length === assetIds.length ? [] : assetIds);
  }

  function handleAddToAlbum() {
    const ids = selectedAssetIds.length > 0 ? selectedAssetIds : assetIds;
    navigation.navigate('AddToAlbumModal', { assetIds: ids });
    toggleSelectMode();
  }

  function handleCreatePost() {
    if (!hasSelection) return;
    navigation.navigate('AddEditPostModal', { assetIds: selectedAssetIds });
    toggleSelectMode();
  }

  function handleDeleteFromAlbum() {
    const selected = getSelectedAssets();
    showActionSheetWithOptions(
      {
        options: ['Remove from album', 'Delete', 'Cancel'],
        cancelButtonIndex: 2,
        title: `${getAssetCountInfo(selected).toLowerCase()} selected`,
      },
      async (index) => {
        if (index === 0) {
          removeAssetsFromAlbum(album, selected);
          toggleSelectMode();
        } else if (index === 1) {
          setAssetsDeleted(selected.map((a) => a.id));
          toggleSelectMode();
        }
      },
    );
  }

  return (
    <Page>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />

      <FloatingDetailHeader
        title={album.name}
        subtitle={headerSubtitle}
        onBack={() => navigation.goBack()}
        isSelectMode={isSelectMode}
        menuSlot={
          isSelectMode ? (
            // Selection toolbar — mirrors the main screen's select pill
            <>
              <PillButton
                iconName="checkbox"
                onPress={handleSelectAll}
                active={selectedAssetIds.length === assetIds.length && assetIds.length > 0}
              />
              <PillButton iconName="download" onPress={handleDownload} disabled={!hasSelection} />
              <PillButton iconName="library" onPress={handleAddToAlbum} disabled={!hasSelection} />
              <PillButton iconName="share" onPress={handleCreatePost} disabled={!hasSelection} />
              {!isSmartAlbum(album) && (
                <PillButton iconName="trash" onPress={handleDeleteFromAlbum} disabled={!hasSelection} danger />
              )}
              <View style={actionButtonStyles.pillSeparator} />
              <GradientButton onPress={toggleSelectMode} style={styles.closeButton}>
                <Icon name="close" color={colors.textInverse} />
              </GradientButton>
            </>
          ) : (
            // Normal toolbar
            <>
              {!isSmartAlbum(album) && <AddAssetAction album={album} />}
              <MoreAction album={album} afterDelete={() => navigation.goBack()} onSelect={toggleSelectMode} />
            </>
          )
        }
      />

      {/* Sub-header — only shown when there's an archived badge or notes */}
      {(!!album.archivedAt || !!album.notes) && (
        <View style={[styles.subHeader, { marginTop: paddingTop }]}>
          {!!album.archivedAt && <Text style={styles.archivedBadge}>Archived</Text>}
          {!!album.notes && (
            <TouchableOpacity
              onPress={() => navigation.navigate('EditNotesModal', { type: 'album', id: album.id, notes: album.notes })}
            >
              <Text style={styles.notesText}>{album.notes}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Active view — content scrolls behind the floating header. The sub-header
          (when present) already reserves the top space, so the list padding drops
          to 0 in that case. */}
      <View style={styles.content}>
        {activeTab === 'Assets' ? (
          <AlbumAssetsView
            assetIds={assetIds}
            isSelectMode={isSelectMode}
            selectedAssetIds={selectedAssetIds}
            onPressAsset={onPressAsset}
            toggleFavoriteAsset={toggleFavoriteAsset}
            openAssetQuickView={openAssetQuickView}
            closeAssetQuickView={closeAssetQuickView}
            sortOrder={sortOrder}
            listRef={listRef}
            paddingTop={hasSubHeader ? 0 : paddingTop}
            paddingBottom={paddingBottom}
            selectAssets={selectAssets}
            reorderEnabled={reorderEnabled}
            onReorder={handleReorder}
          />
        ) : (
          <AlbumPostsView postIds={postIds} paddingTop={hasSubHeader ? 0 : paddingTop} paddingBottom={paddingBottom} />
        )}
      </View>

      {/* Floating segment pill — bottom right (slides out when search is active) */}
      <SegmentPill
        tabs={TABS}
        activeTab={activeTab}
        onTabPress={setActiveTab}
        expandProgress={expandProgress}
        bottom={insets.bottom + spacing.floatingBarBottom}
      />

      {/* Floating search + options bar — bottom left (assets tab only, hidden in select mode) */}
      {activeTab === 'Assets' && !isSelectMode && (
        <SearchOptionsBar
          expandProgress={expandProgress}
          isSearchActive={isSearchActive}
          searchText={searchText}
          onOpenSearch={openSearch}
          onCloseSearch={closeSearch}
          onChangeSearch={setSearchText}
          onOpenOptions={() => setIsSortFilterOpen(true)}
          hasActiveState={activeFilter.length > 0 || !sortOrder.startsWith('createdAt')}
          placeholder="Search notes…"
          bottom={insets.bottom + spacing.floatingBarBottom}
          left={spacing.floatingBarSide}
          maxWidth={screenWidth - spacing.floatingBarSide * 2}
        />
      )}

      {/* Sort / filter modal for the assets view */}
      <SortFilterModal
        visible={isSortFilterOpen}
        onClose={() => setIsSortFilterOpen(false)}
        sortOrder={sortOrder}
        activeFilter={activeFilter}
        sortOptions={sortOptions}
        filterOptions={ASSET_FILTER_OPTIONS}
        onSort={handleSort}
        onFilter={toggleFilter}
        showViewOptions
        bottom={insets.bottom + spacing.floatingBarBottom + spacing.iconButtonSize + spacing.popoverGap}
        left={spacing.floatingBarSide}
      />
    </Page>
  );
}

function SegmentPill({ tabs, activeTab, onTabPress, expandProgress, bottom }) {
  const slideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expandProgress.value, [0, 0.5], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(expandProgress.value, [0, 1], [0, 30], Extrapolation.CLAMP) }],
    pointerEvents: expandProgress.value > 0.3 ? 'none' : 'auto',
  }));

  return (
    <Animated.View
      style={[styles.segmentContainer, { bottom, right: spacing.floatingBarSide }, slideStyle]}
      pointerEvents="box-none"
    >
      <FloatingPill>
        {tabs.map((tab) => (
          <SegmentButton key={tab.key} tab={tab} isActive={activeTab === tab.key} onPress={() => onTabPress(tab.key)} />
        ))}
      </FloatingPill>
    </Animated.View>
  );
}

function PillButton({ iconName, onPress, disabled, danger, active }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        pressed && { backgroundColor: colors.pressedBg },
        disabled && styles.pillButtonDisabled,
      ]}
    >
      <Icon name={iconName} color={active ? colors.accent : danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

function SegmentButton({ tab, isActive, onPress }) {
  if (isActive) {
    return (
      <GradientButton onPress={onPress}>
        <Icon name={tab.icon} color={colors.iconActive} />
      </GradientButton>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
    >
      <Icon name={tab.icon} color={colors.iconInactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  archivedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,200,200,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: scale(10),
    textTransform: 'uppercase',
    fontWeight: '800',
    color: colors.danger,
  },
  notesText: {
    fontSize: typography.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },

  // ── Selection toolbar ────────────────────────────────────────────────────
  pillButtonDisabled: {
    opacity: 0.35,
  },
  closeButton: {
    marginLeft: 2,
  },

  // ── Floating segment pill ─────────────────────────────────────────────────
  segmentContainer: {
    position: 'absolute',
    zIndex: 100,
  },
});
