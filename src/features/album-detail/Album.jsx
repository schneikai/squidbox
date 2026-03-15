import { useActionSheet } from '@expo/react-native-action-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useState, useMemo } from 'react';
import { Text, StyleSheet, View, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import GradientButton from '@/components/GradientButton';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import SuperPressable from '@/components/SuperPressable';
import SearchOptionsBar from '@/components/floating-bars/SearchOptionsBar';
import SortFilterModal from '@/components/floating-bars/SortFilterModal';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import AlbumAssetsView from '@/features/album-detail/AlbumAssetsView';
import AlbumPostsView from '@/features/album-detail/AlbumPostsView';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';
import useAlbums from '@/features/albums-context/useAlbums';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import getAlbumAssets from '@/utils/albums/getAlbumAssets';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import useScreenPadding from '@/hooks/useScreenPadding';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';
import pluralizeText from '@/utils/pluralizeText';

const TABS = [
  { key: 'Assets', icon: 'grid-outline',        iconActive: 'grid' },
  { key: 'Posts',  icon: 'share-social-outline', iconActive: 'share-social' },
];

const ASSET_FILTER_OPTIONS = [
  { key: 'all',       label: 'All Media',  icon: 'apps-outline' },
  { key: 'favorites', label: 'Favorites',  icon: 'heart-outline' },
  { key: 'images',    label: 'Photos',     icon: 'image-outline' },
  { key: 'videos',    label: 'Videos',     icon: 'videocam-outline' },
];

export default function Album({ album }) {
  const { assets, toggleFavoriteAsset, setAssetsDeleted } = useAssets();
  const { removeAssetsFromAlbum } = useAlbums();
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
  const { isSelectMode, selectedAssetIds, toggleSelectMode, toggleSelectAsset } = useToggleSelectAssetsAction();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, matchFilter, toggleFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();
  const [activeTab, setActiveTab] = useState('Assets');
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const { width: screenWidth } = useWindowDimensions();
  const expandProgress = useSharedValue(0);

  function openSearch() { setIsSearchActive(true); }
  function closeSearch() { setIsSearchActive(false); setSearchText(''); }

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

  const hasSelection = selectedAssetIds.length > 0;

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
        subtitle={pluralizeText('1 Asset', '%{count} Assets', assetIds.length)}
        onBack={() => navigation.goBack()}
        isSelectMode={isSelectMode}
        menuSlot={
          isSelectMode ? (
            // Selection toolbar — mirrors the main screen's select pill
            <>
              <PillButton iconName="download-outline" onPress={handleDownload} disabled={!hasSelection} />
              <PillButton iconName="albums-outline" onPress={handleAddToAlbum} disabled={!hasSelection} />
              <PillButton iconName="share-outline" onPress={handleCreatePost} disabled={!hasSelection} />
              {!isSmartAlbum(album) && (
                <PillButton iconName="trash-outline" onPress={handleDeleteFromAlbum} disabled={!hasSelection} danger />
              )}
              <View style={actionButtonStyles.pillSeparator} />
              <GradientButton onPress={toggleSelectMode} style={styles.closeButton}>
                <Ionicons name="close" size={spacing.iconSize} color={colors.textInverse} />
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

      {/* Active view — paddingTop always clears the floating header */}
      <View style={[styles.content, { paddingTop: (!!album.archivedAt || !!album.notes) ? 0 : paddingTop }]}>
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
            paddingBottom={paddingBottom}
          />
        ) : (
          <AlbumPostsView album={album} paddingBottom={paddingBottom} />
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
        filterOptions={ASSET_FILTER_OPTIONS}
        onSort={sortAssets}
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
      style={[
        styles.segmentContainer,
        { bottom, right: spacing.floatingBarSide },
        slideStyle,
      ]}
      pointerEvents="box-none"
    >
      <FloatingPill>
        {tabs.map((tab) => (
          <SegmentButton
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            onPress={() => onTabPress(tab.key)}
          />
        ))}
      </FloatingPill>
    </Animated.View>
  );
}

function PillButton({ iconName, onPress, disabled, danger }) {
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
      <Ionicons name={iconName} size={spacing.iconSize} color={danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

function SegmentButton({ tab, isActive, onPress }) {
  if (isActive) {
    return (
      <GradientButton onPress={onPress}>
        <Ionicons name={tab.iconActive} size={spacing.iconSize} color={colors.iconActive} />
      </GradientButton>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [actionButtonStyles.pillButton, pressed && { backgroundColor: colors.pressedBg }]}
    >
      <Ionicons name={tab.icon} size={spacing.iconSize} color={colors.iconInactive} />
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
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '800',
    color: colors.danger,
  },
  notesText: {
    fontSize: 13,
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
