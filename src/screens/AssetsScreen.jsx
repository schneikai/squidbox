import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, View } from 'react-native';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import SuperPressable from '@/components/SuperPressable';
import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';

export default function AssetsScreen({ route }) {
  const navigation = useNavigation();
  const { assets, toggleFavoriteAsset, setAssetsDeleted } = useAssets();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });
  const { asset: quickViewAsset, open: openAssetQuickView, close: closeAssetQuickView } = useAssetQuickViewModal();

  const {
    isSelectMode,
    selectedAssetIds,
    toggleSelectAsset,
    selectAssets,
    exitSelectMode,
    registerScreenOptions,
    screenOptionsRef,
    searchText,
    scrollY,
  } = useFloatingBars();

  const scrollHandler = useFloatingBarScrollHandler();

  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  const assetIds = useMemo(
    () =>
      prepareAssets({
        assets: Object.values(assets),
        sortFn: sortFunction,
        filterFn: matchFilter,
        searchText,
      }).map((asset) => asset.id),
    [assets, sortFunction, matchFilter, searchText],
  );

  // ── Action handlers wired into FloatingHeader via context ─────────────────
  // Keep a ref that's always current so registered callbacks never go stale,
  // even if the user taps a button before the next useEffect fires.
  const handlersRef = useRef({});
  handlersRef.current = { selectedAssetIds, assetIds, assets };

  async function handleAdd() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  function handleSelectAll() {
    const { selectedAssetIds: ids, assetIds: all } = handlersRef.current;
    selectAssets(ids.length === all.length ? [] : all);
  }

  function handleDownload() {
    const selected = getSelectedAssets();
    screenOptionsRef.current._downloadSelected?.(selected);
  }

  function handleAddToAlbum() {
    const { selectedAssetIds: ids, assetIds: all } = handlersRef.current;
    navigation.navigate('AddToAlbumModal', { assetIds: ids.length > 0 ? ids : all.slice(0, 500) });
    exitSelectMode();
  }

  function handlePost() {
    const { selectedAssetIds: ids } = handlersRef.current;
    if (ids.length === 0) return;
    navigation.navigate('AddEditPostModal', { assetIds: ids });
    exitSelectMode();
  }

  function handleDelete() {
    const selected = getSelectedAssets();
    Alert.alert(`Delete ${selected.length} item${selected.length !== 1 ? 's' : ''}?`, '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setAssetsDeleted(selected.map((a) => a.id));
          exitSelectMode();
        },
      },
    ]);
  }

  function getSelectedAssets() {
    const { selectedAssetIds: ids, assetIds: all, assets: allAssets } = handlersRef.current;
    const resolvedIds = ids.length > 0 ? ids : all.slice(0, 500);
    return Object.values(allAssets).filter((a) => resolvedIds.includes(a.id));
  }

  // Register this screen's options with the floating bars context.
  // Callbacks delegate through handlersRef so they always read the latest
  // selectedAssetIds without needing it as a dependency here.
  useEffect(() => {
    registerScreenOptions('assets', {
      sortOrder,
      activeFilter,
      filterOptions: [
        { key: 'all', label: 'All Media', icon: 'apps-outline' },
        { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
        { key: 'images', label: 'Photos', icon: 'image-outline' },
        { key: 'videos', label: 'Videos', icon: 'videocam-outline' },
      ],
      showViewOptions: true,
      onSort: sortAssets,
      onFilter: toggleFilter,
    });
  }, [sortOrder, activeFilter]);

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    }
  }

  const hasActiveOptions = activeFilter.length > 0 || sortOrder !== 'createdAt:desc';
  const allSelected = assetIds.length > 0 && selectedAssetIds.length === assetIds.length;

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader
        title="Library"
        isAssetsTab
        onAdd={handleAdd}
        onSelectAll={handleSelectAll}
        allSelected={allSelected}
        onDownload={handleDownload}
        onAddToAlbum={handleAddToAlbum}
        onPost={handlePost}
        onDelete={handleDelete}
      />
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={scrollHandler}
        scrollY={scrollY}
        dragSelectEnabled={isSelectMode}
        selectedAssetIds={selectedAssetIds}
        selectAssets={selectAssets}
        renderListItem={(asset) => (
          <SuperPressable
            onPress={() => onPressAsset(asset)}
            onDoublePress={() => toggleFavoriteAsset(asset)}
            onLongPress={() => (isSelectMode ? undefined : openAssetQuickView(asset))}
            onLongPressOut={() => closeAssetQuickView()}
            style={{ flex: 1 }}
          >
            <AssetListItem
              asset={asset}
              isSelectMode={isSelectMode}
              isSelected={selectedAssetIds.includes(asset.id)}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </SuperPressable>
        )}
      />
      <FloatingActionsBar hasActiveState={hasActiveOptions} />
    </View>
  );
}
