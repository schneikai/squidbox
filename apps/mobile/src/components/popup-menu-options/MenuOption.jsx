import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

// A menu row. The menu closes after `onPress` unless it returns false.
export default function MenuOption({ onPress, label, icon, trailing, danger, active = false, emphasized }) {
  return (
    <MenuOptionBase
      onSelect={onPress}
      style={popupMenuStyles.row}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
    >
      <MenuItemContent
        label={label}
        icon={icon}
        trailing={trailing}
        danger={danger}
        active={active}
        emphasized={emphasized}
      />
    </MenuOptionBase>
  );
}
