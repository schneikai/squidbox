import { useNavigation } from 'expo-router';

import DeletedAlbumActionsBar from './DeletedAlbumActionsBar';

import Button from '@/components/Button';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useFloatingPrimaryActionPadding from '@/components/floating-bars/useFloatingPrimaryActionPadding';
import AssetList from '@/features/asset-list/AssetList';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useDeletedAssetsActions from '@/features/assets-context/useDeletedAssetsActions';
import useScreenPadding from '@/hooks/useScreenPadding';
import { getDb } from '@/sync/db/client';
import type { AlbumRow } from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const query = assetQuery({ scope: 'deleted' });

type DeletedAssetsAlbumProps = { album: AlbumRow };
export default function DeletedAssetsAlbum({ album }: DeletedAssetsAlbumProps) {
  const { restore, deletePermanently } = useDeletedAssetsActions();
  const navigation = useNavigation();
  const { paddingTop } = useScreenPadding('detail');
  const paddingBottom = useFloatingPrimaryActionPadding();

  const { isSelectMode, selectedAssetIds, isAssetSelected, toggleSelectMode, exitSelectMode, toggleSelectAsset } =
    useToggleSelectAssetsAction();
  const { rows, count, loadMore } = usePagedQuery(query, 150);

  // Select mode acts on the selection, otherwise on every deleted asset.
  const targetCount = isSelectMode ? selectedAssetIds.length : (count ?? 0);
  const targetIds = isSelectMode ? selectedAssetIds : () => query.ids(getDb());

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
          <Button
            icon="checkbox"
            onPress={toggleSelectMode}
            isSelected={isSelectMode}
            accessibilityLabel={isSelectMode ? 'Done selecting' : 'Select'}
          />
        }
      />
      <AssetList
        rows={rows}
        loadMore={loadMore}
        paddingTop={paddingTop}
        paddingBottom={paddingBottom}
        renderListItem={renderCell}
      />
      <DeletedAlbumActionsBar
        isSelectMode={isSelectMode}
        isDisabled={targetCount === 0}
        onRestore={handleRestoreAssets}
        onDelete={handleDeleteAssets}
      />
    </Page>
  );
}
