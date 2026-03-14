import { useCallback, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import AssetQuickViewModal, { useAssetQuickViewModal } from '@/components/AssetQuickViewModal';
import SuperPressable from '@/components/SuperPressable';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import AssetList from '@/features/asset-list/AssetList';
import AssetListItem from '@/features/asset-list/AssetListItem';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssets from '@/features/assets-context/useAssets';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
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
    exitSelectMode,
    registerScreenOptions,
    screenOptionsRef,
    onScrollUpdate,
    searchText,
  } = useFloatingBars();

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

  async function handleAdd() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  function handleDownload() {
    const selected = getSelectedAssets();
    // Trigger download via the existing save utility
    screenOptionsRef.current._downloadSelected?.(selected);
  }

  function handleAddToAlbum() {
    const ids = selectedAssetIds.length > 0 ? selectedAssetIds : assetIds.slice(0, 500);
    navigation.navigate('AddToAlbumModal', { assetIds: ids });
    exitSelectMode();
  }

  function handlePost() {
    const ids = selectedAssetIds.length > 0 ? selectedAssetIds : [];
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
    const ids = selectedAssetIds.length > 0 ? selectedAssetIds : assetIds.slice(0, 500);
    return Object.values(assets).filter((a) => ids.includes(a.id));
  }

  // Register this screen's options with the floating bars context
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
      onAdd: handleAdd,
      onDownload: handleDownload,
      onAddToAlbum: handleAddToAlbum,
      onPost: handlePost,
      onDelete: handleDelete,
    });
  }, [sortOrder, activeFilter]);

  function onPressAsset(asset) {
    if (isSelectMode) {
      toggleSelectAsset(asset.id);
    } else {
      navigation.navigate('AssetScreen', { assetId: asset.id, assetIds });
    }
  }

  function handleScroll(event) {
    onScrollUpdate(event.nativeEvent.contentOffset.y);
  }

  return (
    <>
      <AssetQuickViewModal asset={quickViewAsset} isVisible={!!quickViewAsset} />
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={handleScroll}
        renderListItem={(asset) => (
          <SuperPressable
            onPress={() => onPressAsset(asset)}
            onDoublePress={() => toggleFavoriteAsset(asset)}
            onLongPress={() => openAssetQuickView(asset)}
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
    </>
  );
}
