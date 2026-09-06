import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function CreatePostSelectionMenuOption({ getSelectedAssets }) {
  const navigation = useNavigation();

  function handleSelect() {
    navigation.navigate('AddEditPostModal', { assetIds: getSelectedAssets().map((asset) => asset.id) });
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: popupMenuStyles.menuOption }}>
      <Text style={popupMenuStyles.menuOptionText}>Create Post</Text>
      <Icon
        name="edit"
        size={spacing.menuIconSize}
        color={colors.darkModalTextDim}
        style={popupMenuStyles.menuOptionIcon}
      />
    </MenuOption>
  );
}
