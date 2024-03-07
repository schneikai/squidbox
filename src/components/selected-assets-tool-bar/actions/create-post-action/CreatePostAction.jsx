import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';

import useSelectedAssets from '@/components/selected-assets-tool-bar/useSelectedAssets';
import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';

export default function CreatePostAction() {
  const navigation = useNavigation();
  const getSelectedAssets = useSelectedAssets();

  function handlePress() {
    navigation.navigate('AddEditPostModal', { assetIds: getSelectedAssets().map((asset) => asset.id) });
  }

  return (
    <Pressable onPress={handlePress} style={selectedAssetsToolBarStyles.button}>
      <Ionicons name="create-outline" style={selectedAssetsToolBarStyles.buttonIcon} />
    </Pressable>
  );
}
