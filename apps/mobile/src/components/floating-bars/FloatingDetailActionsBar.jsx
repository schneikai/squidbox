import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import IconButton from '@/components/IconButton';
import useAssets from '@/features/assets-context/useAssets';
import useDeletedAssetsActions from '@/features/assets-context/useDeletedAssetsActions';
import { colors, scale, spacing } from '@/styles/designTokens';
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
    <View style={[styles.container, { bottom: insets.bottom + spacing.floatingBarBottom }]} pointerEvents="box-none">
      {children}
      <View style={styles.row} pointerEvents="box-none">
        {/* Left pill — share + favorite + download */}
        <FloatingPill>
          {canShareFiles && (
            <IconButton icon="share" onPress={handleShare} color={colors.iconInactive} accessibilityLabel="Share" />
          )}
          {!isDeleted && (
            <IconButton
              icon="heart"
              filled={asset.isFavorite}
              onPress={handleToggleFavorite}
              color={asset.isFavorite ? colors.danger : colors.iconInactive}
              accessibilityLabel={asset.isFavorite ? 'Unfavorite' : 'Favorite'}
            />
          )}
          <IconButton
            icon="cloud-download"
            onPress={handleDownload}
            color={colors.iconInactive}
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
          {isDeleted && (
            <IconButton icon="undo" onPress={handleRestore} color={colors.iconInactive} accessibilityLabel="Restore" />
          )}
          <IconButton
            icon="trash"
            onPress={isDeleted ? handleDeletePermanently : handleDelete}
            variant="danger"
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
    left: spacing.floatingBarSide,
    right: spacing.floatingBarSide,
    gap: spacing.floatingBarBottom,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deletedLabel: {
    paddingHorizontal: spacing.barPaddingX * 2,
    lineHeight: spacing.iconButtonSize,
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.danger,
  },
});
