import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

export default function MenuOption({ label, icon, onPress, danger = false, active = false }) {
  return (
    <MenuOptionBase
      onSelect={onPress}
      style={popupMenuStyles.row}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
    >
      <MenuItemContent label={label} icon={icon} danger={danger} active={active} />
    </MenuOptionBase>
  );
}
