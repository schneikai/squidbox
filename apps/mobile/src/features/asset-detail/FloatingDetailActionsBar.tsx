import type { AssetRecord } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import useAssets from '@/providers/assets/useAssets';
import useDeletedAssetsActions from '@/providers/assets/useDeletedAssetsActions';
import { layout } from '@/styles/designTokens';
import type { AssetFileAsset } from '@/utils/assets/files/getAssetFileStatusAsync';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';
import useShareAssets from '@/utils/assets/useShareAssets';
import confirmDeleteAsync from '@/utils/confirmDeleteAsync';
import canShareFiles from '@/utils/files/canShareFiles';

// What the bar reads of the asset, and what sharing it takes.
type DetailAsset = Pick<AssetRecord, 'id' | 'deletedAt' | 'mediaType' | 'isFavorite'> & AssetFileAsset;

export type FloatingDetailActionsBarProps = {
  asset: DetailAsset;
  onDeleteAsset: (asset: DetailAsset) => void;
  // Opens the asset's details (Info); no Info button without it.
  onShowDetails?: () => void;
  children?: ReactNode;
};

/**
 * Bottom floating action bar for the asset detail screen. `children` (e.g. video controls) go
 * above its row, full width.
 *
 * Layout, as Apple Photos:
 *   [⇪  ♥  ⓘ]                               [🗑]
 *   left pill (share + favorite + info)       right pill (delete)
 *
 * The share sheet saves to the camera roll (on web, Share downloads). Share only where canShareFiles.
 *
 * A trashed asset (shown in a post) gets the Deleted album's actions instead (DeletedNote, under
 * the header, says where it is):
 *   [⇪  ⓘ]                                  [↺  🗑]
 */
export default function FloatingDetailActionsBar({
  asset,
  onDeleteAsset,
  onShowDetails,
  children,
}: FloatingDetailActionsBarProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { toggleFavoriteAsset } = useAssets();
  const { restore, deletePermanently } = useDeletedAssetsActions();
  const shareAssetsAsync = useShareAssets();
  const isDeleted = !!asset.deletedAt;

  function handleToggleFavorite() {
    toggleFavoriteAsset(asset);
  }

  async function handleShare() {
    await shareAssetsAsync([asset]);
  }

  function handleRestore() {
    const mediaType = humanizeMediaType(asset.mediaType);
    restore({ title: `Restore ${mediaType}`, message: `Restore this ${mediaType}?`, ids: [asset.id] });
  }

  function handleDeletePermanently() {
    deletePermanently({
      name: `this ${humanizeMediaType(asset.mediaType).toLowerCase()}`,
      ids: [asset.id],
      onConfirm: () => navigation.goBack(),
    });
  }

  async function handleDelete() {
    if (!(await confirmDeleteAsync({ name: `this ${humanizeMediaType(asset.mediaType).toLowerCase()}` }))) return;
    onDeleteAsset(asset);
    navigation.goBack();
  }

  return (
    <View style={[styles.container, { bottom: insets.bottom + layout.barMargin }]} pointerEvents="box-none">
      {children}
      <View style={styles.row} pointerEvents="box-none">
        {/* Left pill — share + favorite + info */}
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
          {!!onShowDetails && <Button icon="info" onPress={onShowDetails} accessibilityLabel="Info" />}
        </FloatingPill>

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
    gap: layout.barGap,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
