import { useEffect } from 'react';
import { Alert, View } from 'react-native';

import FloatingActionsBar from '@/components/floating-bars/FloatingActionsBar';
import { useFloatingBars } from '@/components/floating-bars/FloatingBarsContext';
import FloatingHeader from '@/components/floating-bars/FloatingHeader';
import useFloatingBarScrollHandler from '@/components/floating-bars/useFloatingBarScrollHandler';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AssetGrid from '@/features/asset-list/AssetGrid';
import assetFilterOptions from '@/features/asset-list/actions/filter-assets-action/assetFilterOptions';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetSelectionActions from '@/features/asset-list/useAssetSelectionActions';
import useAddAssetsFromCameraRoll from '@/features/assets-context/useAddAssetsFromCameraRoll';
import useAssets from '@/features/assets-context/useAssets';
import useListControls from '@/hooks/useListControls';
import useScreenPadding from '@/hooks/useScreenPadding';
import { usePagedQuery } from '@/sync/usePagedQuery';
import confirmAsync from '@/utils/confirmAsync';
import pluralizeText from '@/utils/pluralizeText';

export default function AssetsScreen({ route }) {
  const { setAssetsDeleted } = useAssets();
  const { paddingTop, paddingBottom } = useScreenPadding('main');

  const { listRef, sortOrder, sort, activeFilter, toggleFilter, searchBar, searchText } = useListControls({
    defaultSort: 'createdAt:desc',
  });

  const { setIsSelectMode, scrollY } = useFloatingBars();
  const selection = useToggleSelectAssetsAction();
  const { isSelectMode, selectedAssetIds, isAssetSelected, selectAssets, exitSelectMode } = selection;
  // The floating bars only need to know whether select mode is on (the navigation bar hides).
  useEffect(() => setIsSelectMode(isSelectMode), [isSelectMode]);

  const scrollHandler = useFloatingBarScrollHandler();

  const { show, hide, updateProgress } = useProgressOverlay();
  const runWithProgress = useRunWithProgress();
  const addAssetsFromCameraRollAsync = useAddAssetsFromCameraRoll({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  const query = assetQuery({ scope: 'library', sort: sortOrder, filter: activeFilter, search: searchText });
  const { rows, count, loadMore } = usePagedQuery(query, 150);

  const actions = useAssetSelectionActions(selection, query, count);

  async function handleAdd() {
    try {
      await addAssetsFromCameraRollAsync();
    } catch (error) {
      Alert.alert('Failed to add assets!', error.message);
    }
  }

  async function handleDelete() {
    const title = pluralizeText('Delete 1 item?', 'Delete %{count} items?', selectedAssetIds.length);
    if (!(await confirmAsync({ title, action: 'Delete', destructive: true }))) return;
    exitSelectMode();
    runWithProgress((batchOptions) => setAssetsDeleted(selectedAssetIds, batchOptions));
  }

  return (
    <View style={{ flex: 1 }}>
      <FloatingHeader
        title="Library"
        onAdd={handleAdd}
        selection={selection}
        selectionActions={actions}
        onDelete={handleDelete}
      />
      <AssetGrid
        listRef={listRef}
        rows={rows}
        loadMore={loadMore}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        onScroll={scrollHandler}
        scrollY={scrollY}
        isSelectMode={isSelectMode}
        selectedAssetIds={selectedAssetIds}
        isAssetSelected={isAssetSelected}
        selectAssets={selectAssets}
        onPressAsset={actions.openAsset}
        sortOrder={sortOrder}
      />
      <FloatingActionsBar
        search={searchBar}
        placeholder="Search notes…"
        sortOrder={sortOrder}
        activeFilter={activeFilter}
        filterOptions={assetFilterOptions}
        showViewOptions
        onSort={sort}
        onFilter={toggleFilter}
      />
    </View>
  );
}
