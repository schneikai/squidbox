import { useEffect, useMemo } from 'react';
import { Alert, View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import AssetList from '@/features/asset-list/AssetList';
import useFilterAssetsAction from '@/features/asset-list/actions/filter-assets-action/useFilterAssetsAction';
import useSortAssetsAction from '@/features/asset-list/actions/sort-assets-action/useSortAssetsAction';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import prepareAssets from '@/features/asset-list/prepareAssets';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssetList from '@/features/asset-list/useAssetList';
import useAssetSelectionActions from '@/features/asset-list/useAssetSelectionActions';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import useSearch from '@/hooks/useSearch';
import useSearchMode from '@/hooks/useSearchMode';
import pluralizeText from '@/utils/pluralizeText';

export default function AssetsScreen({ route }) {
  const { assets, setAssetsDeleted } = useAssets();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, listScrollTop } = useAssetList();
  const { sortOrder, sortFunction, sortAssets } = useSortAssetsAction({ afterSort: listScrollTop });
  const { activeFilter, toggleFilter, matchFilter } = useFilterAssetsAction({ afterFilter: listScrollTop });

  const { registerScreenOptions, setIsSelectMode, scrollY } = useFloatingBars();
  const selection = useToggleSelectAssetsAction();
  const { isSelectMode, selectedAssetIds, isAssetSelected, selectAssets, exitSelectMode } = selection;
  // The floating bars only need to know whether select mode is on (the navigation bar hides).
  useEffect(() => setIsSelectMode(isSelectMode), [isSelectMode]);
  const { searchBar, query: searchText } = useSearchMode(useSearch());

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

  const actions = useAssetSelectionActions(selection, assetIds);

  async function handleAdd() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  function handleDelete() {
    Alert.alert(pluralizeText('Delete 1 item?', 'Delete %{count} items?', selectedAssetIds.length), '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setAssetsDeleted(selectedAssetIds);
          exitSelectMode();
        },
      },
    ]);
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

  const { renderCell, quickViewModal } = useAssetCells({
    onPress: actions.openAsset,
    isSelectMode,
    isAssetSelected,
    showLastPostedAt: sortOrder.includes('lastPostedAt'),
  });

  const hasActiveOptions = activeFilter.length > 0 || sortOrder !== 'createdAt:desc';

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader
        title="Library"
        onAdd={handleAdd}
        selection={selection}
        selectionActions={actions}
        onDelete={handleDelete}
      />
      {quickViewModal}
      <AssetList
        listRef={listRef}
        assetIds={assetIds}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        onScroll={scrollHandler}
        scrollY={scrollY}
        dragSelectEnabled={isSelectMode}
        selectedAssetIds={selectedAssetIds}
        selectAssets={selectAssets}
        renderListItem={renderCell}
      />
      <FloatingActionsBar search={searchBar} placeholder="Search notes…" hasActiveState={hasActiveOptions} />
    </View>
  );
}
