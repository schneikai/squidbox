import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Alert } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import useAssets from '@/features/assets-context/useAssets';
import popupMenuStyles from '@/styles/popupMenuStyles';
import getAssetCountInfo from '@/utils/assets/getAssetCountInfo';

export default function DeleteSelectionMenuOption({ getSelectedAssets, afterAction }) {
  const { setAssetsDeleted } = useAssets();

  function handleSelect() {
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
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: { ...popupMenuStyles.menuOption, ...popupMenuStyles.menuOptionLast } }}>
      <Text style={popupMenuStyles.menuOptionText}>Delete</Text>
      <Ionicons name="trash-outline" style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
