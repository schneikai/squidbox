import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo } from 'react';
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
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import getAssetsByIds from '@/utils/assets/queries/getAssetsByIds';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

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
    isAssetSelected,
    toggleSelectAsset,
    selectAssets,
    exitSelectMode,
    registerScreenOptions,
    scrollY,
  } = useFloatingBars();
  const { searchBar, query: searchText } = useSearchMode(useSearch());

  const scrollHandler = useFloatingBarScrollHandler();

  const { show, hide, updateProgress } = useProgressOverlay();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
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

  async function handleAdd() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  function handleSelectAll() {
    selectAssets(selectedAssetIds.length === assetIds.length ? [] : assetIds);
  }

  async function handleDownload() {
    await saveAssetsToMediaLibraryAsync(getSelectedAssets());
  }

  function handleAddToAlbum() {
    navigation.navigate('AddToAlbumModal', { assetIds: selectedAssetIds });
    exitSelectMode();
  }

  function handlePost() {
    navigation.navigate('AddEditPostModal', { assetIds: selectedAssetIds });
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
    return getAssetsByIds(assets, selectedAssetIds);
  }

  // Register this screen's options with the floating bars context.
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
              isSelected={isAssetSelected(asset.id)}
              showLastPostedAt={sortOrder.includes('lastPostedAt')}
            />
          </SuperPressable>
        )}
      />
      <FloatingActionsBar search={searchBar} placeholder="Search notes…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
