import { useNavigation } from '@react-navigation/native';
import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import Icon from '@/components/Icon';
import { colors, spacing } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function AddToAlbumSelectionMenuOption({ getSelectedAssets }) {
  const navigation = useNavigation();

  function handleSelect() {
    navigation.navigate('AddToAlbumModal', { assetIds: getSelectedAssets().map((asset) => asset.id) });
  }

  return (
    <MenuOption onSelect={handleSelect} customStyles={{ optionWrapper: popupMenuStyles.menuOption }}>
      <Text style={popupMenuStyles.menuOptionText}>Add to Album</Text>
      <Icon
        name="library"
        size={spacing.menuIconSize}
        color={colors.darkModalTextDim}
        style={popupMenuStyles.menuOptionIcon}
      />
    </MenuOption>
  );
}
