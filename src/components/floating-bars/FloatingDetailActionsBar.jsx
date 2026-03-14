import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FloatingPill from './FloatingPill';
import useProgressOverlay from '@/components/progress-overlay/useProgressOverlay';
import useAssets from '@/features/assets-context/useAssets';
import humanizeMediaType from '@/utils/assets/humanizeMediaType';
import useSaveAssetsToMediaLibrary from '@/utils/assets/useSaveAssetsToMediaLibrary';
import { colors, spacing } from '@/styles/designTokens';

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
    <View
      style={[
        styles.container,
        { bottom: insets.bottom + spacing.floatingBarBottom },
      ]}
      pointerEvents="box-none"
    >
      {/* Left pill — favorite + download */}
      <FloatingPill>
        <ActionButton onPress={handleToggleFavorite}>
          <Ionicons
            name={asset.isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={asset.isFavorite ? colors.danger : colors.iconInactive}
          />
        </ActionButton>
        <ActionButton onPress={handleDownload}>
          <Ionicons name="cloud-download-outline" size={20} color={colors.iconInactive} />
        </ActionButton>
      </FloatingPill>

      {/* Right pill — delete */}
      <FloatingPill>
        <ActionButton onPress={handleDelete} danger>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
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
        styles.button,
        pressed && (danger ? styles.buttonPressedDanger : styles.buttonPressed),
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
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: spacing.iconButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  buttonPressedDanger: {
    backgroundColor: colors.dangerLight,
  },
});
