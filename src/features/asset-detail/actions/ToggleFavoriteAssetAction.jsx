import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';

import useAssets from '@/features/assets-context/useAssets';
import headerActionStyles from '@/styles/headerActionStyles';

export default function ToggleFavoriteAssetAction({ asset }) {
  const { toggleFavoriteAsset } = useAssets();

  return (
    <Pressable onPress={() => toggleFavoriteAsset(asset)} style={headerActionStyles.button}>
      <Ionicons
        name={asset.isFavorite ? 'heart' : 'heart-outline'}
        style={[headerActionStyles.buttonIcon, asset.isFavorite && { color: 'crimson' }]}
      />
    </Pressable>
  );
}
