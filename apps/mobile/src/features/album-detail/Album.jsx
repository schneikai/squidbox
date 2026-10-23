import { useActionSheet } from '@expo/react-native-action-sheet';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import FloatingSegmentPill from '@/components/floating-bars/FloatingSegmentPill';
import SearchSortFilterBar from '@/components/floating-bars/SearchSortFilterBar';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import reorderUnderSort from '@/components/sortable-grid/reorderUnderSort';
import AlbumPostsView from '@/features/album-detail/AlbumPostsView';
import AddAssetAction from '@/features/album-detail/actions/AddAssetAction';
import MoreAction from '@/features/album-detail/actions/MoreAction';
import ArchivedBadge from '@/features/album-list/ArchivedBadge';
import useAlbums from '@/features/albums-context/useAlbums';
import useAppSettings from '@/features/app-settings/useAppSettings';
import AssetGrid from '@/features/asset-list/AssetGrid';
import SelectionActions from '@/features/asset-list/SelectionActions';
import assetFilterOptions from '@/features/asset-list/actions/filter-assets-action/assetFilterOptions';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetSelectionActions from '@/features/asset-list/useAssetSelectionActions';
import useAssets from '@/features/assets-context/useAssets';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { colors, lineHeights, typography } from '@/styles/designTokens';
import { countByMediaType } from '@/sync/assetsRepository';
import { getDb } from '@/sync/db/client';
import { usePagedQuery } from '@/sync/usePagedQuery';
import getAlbumAssetScope from '@/utils/albums/getAlbumAssetScope';
import getAlbumSortOrder from '@/utils/albums/getAlbumSortOrder';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';
import pluralizeText from '@/utils/pluralizeText';

const TABS = [
  { key: 'Assets', icon: 'grid', label: 'Assets' },
  { key: 'Posts', icon: 'share-alt', label: 'Posts' },
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
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const { showActionSheetWithOptions } = useActionSheet();

  const { listRef, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls({ onSort: applySort });
  const runWithProgress = useRunWithProgress();
  const selection = useToggleSelectAssetsAction();
  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, exitSelectMode, selectAssets } = selection;
  // A per-session override lets the open album react immediately to sort/reorder changes.
  const [sessionSortOrder, setSessionSortOrder] = useState(null);
  const sortOrder = sessionSortOrder ?? getAlbumSortOrder(album, albumSortOrder);
  const [activeTab, setActiveTab] = useState('Assets');
  const [postCount, setPostCount] = useState();
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

  function applySort(order) {
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
  }

  // A drag under another sort adopts the order on screen and switches the album to Custom
  // (reorderUnderSort); the loaded grid keeps its depth, so no scroll-to-top. A failed write goes back
  // to the sort it was made on.
  function handleReorder(change) {
    return reorderUnderSort(change, {
      sortOrder,
      setSortOrder: (order) => {
        keepLimit({ ...query.descriptor, sort: order });
        setSessionSortOrder(order);
      },
      // The grid is paged, so `change.order` holds only the loaded rows; the write reads the album's
      // full order under `sort` itself.
      move: ({ id, afterId }, sort) => reorderAlbumAssets(album, { assetId: id, afterId, sort }),
    });
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
              <MoreAction album={album} afterDelete={() => navigation.goBack()} onSelect={toggleSelectMode} />
              {!isSmart && <AddAssetAction album={album} />}
            </>
          )
        }
      />

      {/* Sub-header — only shown when there's an archived badge or notes */}
      {hasSubHeader && (
        <View style={[styles.subHeader, { marginTop: paddingTop }]}>
          {!!album.archivedAt && <ArchivedBadge />}
          {!!album.notes && (
            <TouchableOpacity
              onPress={() => navigation.navigate('EditAlbumNotesModal', { id: album.id, notes: album.notes })}
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
          <AssetGrid
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

      <FloatingSegmentPill
        tabs={TABS}
        activeTab={activeTab}
        onTabPress={setActiveTab}
        expandProgress={expandProgress}
      />

      {/* Assets tab only, hidden in select mode */}
      {activeTab === 'Assets' && !isSelectMode && (
        <SearchSortFilterBar
          search={searchBar}
          expandProgress={expandProgress}
          placeholder="Search notes…"
          sortOrder={sortOrder}
          sortOptions={sortOptions}
          activeFilter={activeFilter}
          filterOptions={assetFilterOptions}
          onSort={sort}
          onFilter={toggleFilter}
          showViewOptions
        />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  notesText: {
    fontSize: typography.footnote,
    color: colors.text.secondary,
    lineHeight: lineHeights.footnote,
  },
  content: {
    flex: 1,
  },
});
