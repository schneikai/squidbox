import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import Button from '@/components/Button';
import useAssets from '@/features/assets-context/useAssets';
import useDeletedAssetsActions from '@/features/assets-context/useDeletedAssetsActions';
import { colors, layout, sizes, typography } from '@/styles/designTokens';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import useShareAsset from '@/utils/assets/useShareAsset';
import confirmAsync from '@/utils/confirmAsync';
import canShareFiles from '@/utils/files/canShareFiles';

/**
 * Bottom floating action bar for the asset detail screen. `children` (e.g. video controls) go
 * above its row, full width.
 *
 * Layout:
 *   [⇪  ♥  ↓]                               [🗑]
 *   left pill (share + favorite + download)   right pill (delete)
 *   (Share only in a build with expo-sharing's native module)
 *
 * A trashed asset (shown in a post) gets the Deleted album's actions instead, and says it's deleted:
 *   [⇪  ↓]          Deleted           [↺  🗑]
 */
export default function FloatingDetailActionsBar({ asset, onDeleteAsset, navigation, children }) {
  const insets = useSafeAreaInsets();
  const { toggleFavoriteAsset } = useAssets();
  const { restore, deletePermanently } = useDeletedAssetsActions();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary();
  const shareAssetAsync = useShareAsset();
  const isDeleted = !!asset.deletedAt;

  function handleToggleFavorite() {
    toggleFavoriteAsset(asset);
  }

  async function handleShare() {
    await shareAssetAsync(asset);
  }

  async function handleDownload() {
    await saveAssetsToMediaLibraryAsync([asset]);
  }

  function handleRestore() {
    const mediaType = humanizeMediaType(asset.mediaType);
    restore({ title: `Restore ${mediaType}`, message: `Restore this ${mediaType}?`, ids: [asset.id] });
  }

  function handleDeletePermanently() {
    const mediaType = humanizeMediaType(asset.mediaType);
    deletePermanently({
      title: `Delete ${mediaType}`,
      message: `Permanently delete this ${mediaType}?`,
      ids: [asset.id],
      onConfirm: () => navigation.goBack(),
    });
  }

  async function handleDelete() {
    const mediaType = humanizeMediaType(asset.mediaType);
    const message = `Are you sure you want to delete this ${mediaType}?`;
    if (!(await confirmAsync({ title: `Delete ${mediaType}`, message, action: 'Delete', destructive: true }))) return;
    onDeleteAsset(asset);
    navigation.goBack();
  }

  return (
    <View style={[styles.container, { bottom: insets.bottom + layout.barBottom }]} pointerEvents="box-none">
      {children}
      <View style={styles.row} pointerEvents="box-none">
        {/* Left pill — share + favorite + download */}
        <FloatingPill>
          {canShareFiles && <Button icon="share" onPress={handleShare} accessibilityLabel="Share" />}
          {!isDeleted && (
            <Button
              icon="heart"
              colorPalette="favorite"
              isSelected={asset.isFavorite}
              filled={asset.isFavorite}
              onPress={handleToggleFavorite}
              accessibilityLabel={asset.isFavorite ? 'Unfavorite' : 'Favorite'}
            />
          )}
          <Button
            icon="cloud-download"
            onPress={handleDownload}

            accessibilityLabel="Save to camera roll"
          />
        </FloatingPill>

        {isDeleted && (
          <FloatingPill>
            <Text style={styles.deletedLabel}>Deleted</Text>
          </FloatingPill>
        )}

        {/* Right pill — delete, or restore + delete permanently */}
        <FloatingPill>
          {isDeleted && <Button icon="undo" onPress={handleRestore} accessibilityLabel="Restore" />}
          <Button
            icon="trash"
            onPress={isDeleted ? handleDeletePermanently : handleDelete}
            colorPalette="danger"
            accessibilityLabel={isDeleted ? 'Delete permanently' : 'Delete'}
          />
        </FloatingPill>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    gap: layout.barBottom,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deletedLabel: {
    paddingHorizontal: layout.barPaddingX * 2,
    lineHeight: sizes.iconButton,
    fontSize: typography.footnote,
    fontWeight: '600',
    color: colors.status.danger,
  },
});
