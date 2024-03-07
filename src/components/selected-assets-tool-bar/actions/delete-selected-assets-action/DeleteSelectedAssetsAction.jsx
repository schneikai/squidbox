import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Alert } from 'react-native';

import useSelectedAssets from '@/components/selected-assets-tool-bar/useSelectedAssets';
import useAssets from '@/features/assets-context/useAssets';
import selectedAssetsToolBarStyles from '@/styles/selectedAssetsToolBarStyles';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export default function DeleteSelectedAssetsAction({ afterAction }) {
  const { setAssetsDeleted } = useAssets();
  const getSelectedAssets = useSelectedAssets();

  function handlePress() {
    const selectedAssets = getSelectedAssets();

    Alert.alert(`Delete ${getAssetCountInfo(selectedAssets)}?`, '', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setAssetsDeleted(selectedAssets.map((asset) => asset.id));
          if (afterAction) afterAction();
        },
      },
    ]);
  }

  return (
    <Pressable onPress={handlePress} style={selectedAssetsToolBarStyles.button}>
      <Ionicons
        name="trash-outline"
        style={[selectedAssetsToolBarStyles.buttonIcon, selectedAssetsToolBarStyles.buttonIconDanger]}
      />
    </Pressable>
  );
}
