import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';

import Icon from '@/components/Icon';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';

/**
 * Bottom floating action bar for the asset detail screen.
 *
 * Layout:
 *   [♥  ↓]                           [🗑]
 *   left pill (favorite + download)   right pill (delete)
 */
export default function FloatingDetailActionsBar({ asset, onDeleteAsset, navigation }) {
  const insets = useSafeAreaInsets();
  const { toggleFavoriteAsset } = useAssets();
  const { show, hide, updateProgress } = useProgressOverlay();
  const saveAssetsToMediaLibraryAsync = useSaveAssetsToMediaLibrary({
    onStart: show,
    onProgress: updateProgress,
    onFinish: hide,
  });

  function handleToggleFavorite() {
    toggleFavoriteAsset(asset);
  }

  async function handleDownload() {
    await saveAssetsToMediaLibraryAsync([asset]);
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
      {/* Left pill — favorite + download */}
      <FloatingPill>
        <ActionButton onPress={handleToggleFavorite}>
          <Icon name="heart" filled={asset.isFavorite} color={asset.isFavorite ? colors.danger : colors.iconInactive} />
        </ActionButton>
        <ActionButton onPress={handleDownload}>
          <Icon name="cloud-download" color={colors.iconInactive} />
        </ActionButton>
      </FloatingPill>

      {/* Right pill — delete */}
      <FloatingPill>
        <ActionButton onPress={handleDelete} danger>
          <Icon name="trash" color={colors.danger} />
        </ActionButton>
      </FloatingPill>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 100,
  },
});
