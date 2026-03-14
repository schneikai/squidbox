import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import useAssets from '@/features/assets-context/useAssets';
import { colors, spacing } from '@/styles/designTokens';

export default function ToggleFavoriteAssetAction({ asset }) {
  const { toggleFavoriteAsset } = useAssets();

  return (
    <Pressable
      onPress={() => toggleFavoriteAsset(asset)}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons
        name={asset.isFavorite ? 'heart' : 'heart-outline'}
        size={20}
        color={asset.isFavorite ? colors.danger : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: spacing.iconButtonSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
});
