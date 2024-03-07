import { Text } from 'react-native';
import { MenuOption } from 'react-native-popup-menu';

import popupMenuStyles from '@/styles/popupMenuStyles';

export default function TextMenuOption({ label, onPress, isLast = false }) {
  return (
    <MenuOption onSelect={onPress} style={[popupMenuStyles.menuOption, isLast && popupMenuStyles.menuOptionLast]}>
      <Text style={popupMenuStyles.menuOptionText}>{label}</Text>
    </MenuOption>
  );
}
