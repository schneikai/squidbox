import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import Icon from '@/components/Icon';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import useDeletedAssetsActions from '@/features/assets-context/useDeletedAssetsActions';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, scale, spacing } from '@/styles/designTokens';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

/**
 * Bottom floating action bar for the asset detail screen. `children` (e.g. video controls) go
 * above its row, full width.
 *
 * Layout:
 *   [♥  ↓]                           [🗑]
 *   left pill (favorite + download)   right pill (delete)
 *
 * A trashed asset (shown in a post) gets the Deleted album's actions instead, and says it's deleted:
 *   [↓]          Deleted           [↺  🗑]
 */
export default function FloatingDetailActionsBar({ asset, onDeleteAsset, navigation, children }) {
  const insets = useSafeAreaInsets();
  const { toggleFavoriteAsset } = useAssets();
  const { restore, deletePermanently } = useDeletedAssetsActions();
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });
  const isDeleted = !!asset.deletedAt;

  function handleToggleFavorite() {
    toggleFavoriteAsset(asset);
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

  function handleDelete() {
    Alert.alert(
      `Delete ${humanizeMediaType(asset.mediaType)}`,
      `Are you sure you want to delete this ${humanizeMediaType(asset.mediaType)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteAsset(asset);
            navigation.goBack();
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { bottom: insets.bottom + spacing.floatingBarBottom }]} pointerEvents="box-none">
      {children}
      <View style={styles.row} pointerEvents="box-none">
        {/* Left pill — favorite + download */}
        <FloatingPill>
          {!isDeleted && (
            <ActionButton onPress={handleToggleFavorite}>
              <Icon
                name="heart"
                filled={asset.isFavorite}
                color={asset.isFavorite ? colors.danger : colors.iconInactive}
              />
            </ActionButton>
          )}
          <ActionButton onPress={handleDownload}>
            <Icon name="cloud-download" color={colors.iconInactive} />
          </ActionButton>
        </FloatingPill>

        {isDeleted && (
          <FloatingPill>
            <Text style={styles.deletedLabel}>Deleted</Text>
          </FloatingPill>
        )}

        {/* Right pill — delete, or restore + delete permanently */}
        <FloatingPill>
          {isDeleted && (
            <ActionButton onPress={handleRestore}>
              <Icon name="undo" color={colors.iconInactive} />
            </ActionButton>
          )}
          <ActionButton onPress={isDeleted ? handleDeletePermanently : handleDelete} danger>
            <Icon name="trash" color={colors.danger} />
          </ActionButton>
        </FloatingPill>
      </View>
    </View>
  );
}

function ActionButton({ onPress, danger = false, children }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        pressed && (danger ? actionButtonStyles.buttonDanger : { backgroundColor: colors.pressedBg }),
      ]}
    >
      {children}
    </Pressable>
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
    paddingHorizontal: spacing.barPaddingY * 2,
    fontSize: scale(13),
    fontWeight: '600',
    color: colors.danger,
  },
});
