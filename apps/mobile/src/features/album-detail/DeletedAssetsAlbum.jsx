import { useNavigation } from '@react-navigation/native';

import IconButton from '@/components/IconButton';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import AssetList from '@/features/asset-list/AssetList';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useDeletedAssetsActions from '@/features/assets-context/useDeletedAssetsActions';
import useScreenPadding from '@/hooks/useScreenPadding';
import { getDb } from '@/sync/db/client';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const query = assetQuery({ scope: 'deleted' });

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { restore, deletePermanently } = useDeletedAssetsActions();
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');

  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, exitSelectMode, toggleSelectAsset } =
    useToggleSelectAssetsAction();
  const { rows, count, loadMore } = usePagedQuery(query, 150);

  // Select mode acts on the selection, otherwise on every deleted asset.
  const targetCount = isSelectMode ? selectedAssetIds.length : (count ?? 0);
  const targetIds = () => (isSelectMode ? selectedAssetIds : query.ids(getDb()));

  function handleRestoreAssets() {
    const message = isSelectMode
      ? pluralizeText('Restore the selected asset?', 'Restore the %{count} selected assets?', targetCount)
      : pluralizeText('Restore the deleted asset?', 'Restore all %{count} deleted assets?', targetCount);

    restore({
      title: isSelectMode ? 'Restore selected' : 'Restore all',
      message,
      ids: targetIds,
      onConfirm: exitSelectMode,
    });
  }

  function handleDeleteAssets() {
    const message = isSelectMode
      ? pluralizeText(
          'Permanently delete the selected asset?',
          'Permanently delete the %{count} selected assets?',
          targetCount,
        )
      : pluralizeText(
          'Permanently delete the deleted asset?',
          'Permanently delete all %{count} deleted assets?',
          targetCount,
        );

    deletePermanently({
      title: isSelectMode ? 'Delete selected' : 'Delete all',
      message,
      ids: targetIds,
      onConfirm: exitSelectMode,
    });
  }

  const { renderCell } = useAssetCells({
    onPress: isSelectMode ? (asset) => toggleSelectAsset(asset.id) : undefined,
    isSelectMode,
    isAssetSelected,
    canPeek: false,
  });

  return (
    <Page>
      <FloatingDetailHeader
        title={album.name}
        onBack={() => navigation.goBack()}
        menuSlot={
          <>
            <IconButton icon="undo" onPress={handleRestoreAssets} accessibilityLabel="Restore" />
            <IconButton icon="checkbox" onPress={toggleSelectMode} accessibilityLabel="Select" />
            <IconButton
              icon="trash"
              onPress={handleDeleteAssets}
              variant="danger"
              accessibilityLabel="Delete permanently"
            />
          </>
        }
      />
      <AssetList
        rows={rows}
        loadMore={loadMore}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        renderListItem={renderCell}
      />
    </Page>
  );
}
