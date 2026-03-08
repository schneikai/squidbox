import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import popupMenuStyles from '@/styles/popupMenuStyles';

export default function AddToAlbumSelectionMenuOption({ getSelectedAssets }) {
  const navigation = useNavigation();

  function handleSelect() {
    navigation.navigate('AddToAlbumModal', { assetIds: getSelectedAssets().map((asset) => asset.id) });
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: popupMenuStyles.menuOption }}>
      <Text style={popupMenuStyles.menuOptionText}>Add to Album</Text>
      <Ionicons name="albums-outline" style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
