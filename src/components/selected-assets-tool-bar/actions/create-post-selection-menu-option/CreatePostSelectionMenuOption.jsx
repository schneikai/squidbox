import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import popupMenuStyles from '@/styles/popupMenuStyles';

export default function CreatePostSelectionMenuOption({ getSelectedAssets }) {
  const navigation = useNavigation();

  function handleSelect() {
    navigation.navigate('AddEditPostModal', { assetIds: getSelectedAssets().map((asset) => asset.id) });
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: popupMenuStyles.menuOption }}>
      <Text style={popupMenuStyles.menuOptionText}>Create Post</Text>
      <Ionicons name="create-outline" style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
