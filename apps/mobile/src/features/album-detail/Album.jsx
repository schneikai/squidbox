import { useActionSheet } from '@expo/react-native-action-sheet';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Text, StyleSheet, View, Pressable, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientButton from '@/components/GradientButton';
import Icon from '@/components/Icon';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import SearchOptionsBar from '@/components/floating-bars/SearchOptionsBar';
import SortFilterModal from '@/components/floating-bars/SortFilterModal';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AlbumAssetsView from '@/features/album-detail/AlbumAssetsView';
import AlbumPostsView from '@/features/album-detail/AlbumPostsView';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import SelectionActions from '@/features/asset-list/SelectionActions';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetSelectionActions from '@/features/asset-list/useAssetSelectionActions';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, scale, spacing, typography } from '@/styles/designTokens';
import { countByMediaType } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { usePagedQuery } from '@/sync/usePagedQuery';
import getAlbumAssetScope from '@/utils/albums/getAlbumAssetScope';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
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
  const { setAssetsDeleted } = useAssets();
  const { removeAssetsFromAlbum, reorderAlbumAssets, updateAlbum } = useAlbums();
  const { albumSortOrder, setAlbumSortOrder } = useAppSettings();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { showActionSheetWithOptions } = useActionSheet();

  const { listRef, listScrollTop } = useAssetList();
  const runWithProgress = useRunWithProgress();
  const selection = useToggleSelectAssetsAction();
  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, exitSelectMode, selectAssets } = selection;
  // A per-session override lets the open album react immediately to sort/reorder changes.
  const [sessionSortOrder, setSessionSortOrder] = useState(null);
  const sortOrder = sessionSortOrder ?? getAlbumSortOrder(album, albumSortOrder);
  const { activeFilter, toggleFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const [activeTab, setActiveTab] = useState('Assets');
  const [postCount, setPostCount] = useState();
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);
  const { searchBar, query: searchText } = useSearchMode(useSearch());
  const { width: screenWidth } = useWindowDimensions();
  const expandProgress = useSharedValue(0);

  const query = assetQuery({
    scope: getAlbumAssetScope(album),
    sort: sortOrder,
    filter: activeFilter,
    search: searchText,
  });
  const { rows, count, readAt, loadMore, keepLimit } = usePagedQuery(query, 150, { withReadAt: true });

  const actions = useAssetSelectionActions(selection, query, count);
  const hasSubHeader = !!album.archivedAt || !!album.notes;
  const isSmart = isSmartAlbum(album);

  // Drag-to-reorder only makes sense on the full, unfiltered album order and has
  // nowhere to persist for smart albums, so it stays off otherwise.
  const reorderEnabled =
    activeTab === 'Assets' && !isSelectMode && !isSmart && activeFilter.length === 0 && !searchText.trim();

  // Smart albums (Favorites/Deleted) have no stored order, so hide "Custom".
  const sortOptions = isSmart ? ASSET_SORT_OPTIONS.filter((option) => option.key !== 'custom') : ASSET_SORT_OPTIONS;

  function handleSort(order) {
    if (order === 'custom') {
      // Custom is per-album: flag this album and leave the global sort alone.
      updateAlbum(album.id, { sortOrder: 'custom' });
    } else {
      // Any date sort becomes the shared default and takes this album off custom
      // (its edge positions, the custom order, are kept for later).
      setAlbumSortOrder(order);
      updateAlbum(album.id, { sortOrder: null });
    }
    setSessionSortOrder(order);
    listScrollTop();
  }

  // A drag under any sort adopts the order on screen and switches the album to Custom, like
  // Reminders; the loaded grid keeps its depth, so no scroll-to-top. A failed write shows the order
  // the database holds: the album's stored sort (an earlier drag may have made it Custom).
  async function handleReorder(change) {
    if (sortOrder !== 'custom') {
      keepLimit({ ...query.descriptor, sort: 'custom' });
      setSessionSortOrder('custom');
    }
    try {
      await reorderAlbumAssets(album, { ...change, sort: sortOrder });
    } catch (error) {
      keepLimit({ ...query.descriptor, sort: getAlbumSortOrder(album, albumSortOrder) });
      setSessionSortOrder(null);
      throw error;
    }
  }

  const headerSubtitle =
    activeTab === 'Posts'
      ? pluralizeText('1 Post', '%{count} Posts', postCount ?? 0)
      : pluralizeText('1 Asset', '%{count} Assets', count ?? 0);

  async function handleDeleteFromAlbum() {
    const counts = await countByMediaType(getDb(), selectedAssetIds);
    showActionSheetWithOptions(
      {
        options: ['Remove from album', 'Delete', 'Cancel'],
        cancelButtonIndex: 2,
        title: `${getAssetCountInfo(counts).toLowerCase()} selected`,
      },
      (index) => {
        if (index === 2) return;
        exitSelectMode();
        runWithProgress((batchOptions) =>
          index === 0
            ? removeAssetsFromAlbum(album, selectedAssetIds, batchOptions)
            : setAssetsDeleted(selectedAssetIds, batchOptions),
        );
      },
    );
  }

  return (
    <Page>
      <FloatingDetailHeader
        title={album.name}
        subtitle={headerSubtitle}
        onBack={() => navigation.goBack()}
        isSelectMode={isSelectMode}
        menuSlot={
          isSelectMode ? (
            <SelectionActions
              actions={actions}
              onDelete={isSmart ? undefined : handleDeleteFromAlbum}
              onClose={exitSelectMode}
            />
          ) : (
            // Normal toolbar
            <>
              {!isSmart && <AddAssetAction album={album} />}
              <MoreAction album={album} afterDelete={() => navigation.goBack()} onSelect={toggleSelectMode} />
            </>
          )
        }
      />

      {/* Sub-header — only shown when there's an archived badge or notes */}
      {hasSubHeader && (
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
            rows={rows}
            rowsReadAt={readAt}
            loadMore={loadMore}
            isSelectMode={isSelectMode}
            selectedAssetIds={selectedAssetIds}
            isAssetSelected={isAssetSelected}
            onPressAsset={actions.openAsset}
            sortOrder={sortOrder}
            listRef={listRef}
            paddingTop={hasSubHeader ? 0 : paddingTop}
            paddingBottom={paddingBottom}
            selectAssets={selectAssets}
            isSortable={!isSmart}
            reorderEnabled={reorderEnabled}
            onReorder={handleReorder}
          />
        ) : (
          <AlbumPostsView
            albumId={album.id}
            onCount={setPostCount}
            paddingTop={hasSubHeader ? 0 : paddingTop}
            paddingBottom={paddingBottom}
          />
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
          {...searchBar}
          expandProgress={expandProgress}
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

  // ── Floating segment pill ─────────────────────────────────────────────────
  segmentContainer: {
    position: 'absolute',
    zIndex: 100,
  },
});
