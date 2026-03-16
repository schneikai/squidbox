import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import { colors, spacing } from '@/styles/designTokens';
import popupMenuStyles from '@/styles/popupMenuStyles';

export default function MenuOption({ label, icon, onPress, isLast = false, danger = false, active = false }) {
  return (
    <MenuOptionBase
      onSelect={onPress}
      style={[popupMenuStyles.menuOption, isLast && popupMenuStyles.menuOptionLast]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={spacing.menuIconSize}
          color={danger ? colors.danger : active ? colors.accent : colors.darkModalTextDim}
          style={popupMenuStyles.menuOptionIcon}
        />
      )}
      <Text style={[popupMenuStyles.menuOptionText, danger && popupMenuStyles.menuOptionTextDanger]}>
        {label}
      </Text>
      {active && <View style={popupMenuStyles.activeDot} />}
    </MenuOptionBase>
  );
}
