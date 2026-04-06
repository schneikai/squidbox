import { Text, Alert } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import Icon from '@/components/Icon';
import useAssets from '@/features/assets-context/useAssets';
import popupMenuStyles from '@/styles/popupMenuStyles';
import { colors, spacing } from '@/styles/designTokens';
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
      <Icon name="trash" size={spacing.menuIconSize} color={colors.danger} style={popupMenuStyles.menuOptionIcon} />
    </MenuOption>
  );
}
