import { useNavigation } from '@react-navigation/native';
import { Alert, StyleSheet, View } from 'react-native';

import IconButton from '@/components/IconButton';
import Page from '@/components/Page';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import useRunWithProgress from '@/components/progress-overlay/useRunWithProgress';
import AssetList from '@/features/asset-list/AssetList';
import useToggleSelectAssetsAction from '@/features/asset-list/actions/toggle-select-assets-action/useToggleSelectAssetsAction';
import assetQuery from '@/features/asset-list/assetQuery';
import useAssetCells from '@/features/asset-list/useAssetCells';
import useAssets from '@/features/assets-context/useAssets';
import useScreenPadding from '@/hooks/useScreenPadding';
import { colors } from '@/styles/designTokens';
import { getDb } from '@/sync/db/client';
import { usePagedQuery } from '@/sync/usePagedQuery';
import pluralizeText from '@/utils/pluralizeText';

const query = assetQuery({ scope: 'deleted' });

export default function AlbumScreenComponentForDeletedAssets({ album }) {
  const { restoreDeletedAssets, deleteAssetsAsync } = useAssets();
  const navigation = useNavigation();
  const { paddingTop, paddingBottom } = useScreenPadding('detail');
  const runWithProgress = useRunWithProgress();

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

    Alert.alert(isSelectMode ? 'Restore selected' : 'Restore all', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore',
        onPress: async () => {
          const ids = await targetIds();
          exitSelectMode();
          runWithProgress((batchOptions) => restoreDeletedAssets(ids, batchOptions));
        },
      },
    ]);
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

    Alert.alert(isSelectMode ? 'Delete selected' : 'Delete all', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          const ids = await targetIds();
          exitSelectMode();
          try {
            await runWithProgress((batchOptions) => deleteAssetsAsync(ids, batchOptions));
          } catch (error) {
            Alert.alert('Failed to delete assets!', error.message);
          }
        },
      },
    ]);
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
          <View style={styles.menuRow}>
            <IconButton icon="undo" onPress={handleRestoreAssets} />
            <IconButton icon="checkbox" onPress={toggleSelectMode} />
            <IconButton icon="trash" onPress={handleDeleteAssets} color={colors.danger} />
          </View>
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

const styles = StyleSheet.create({
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
