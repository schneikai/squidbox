import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

// A menu row. The menu closes after `onPress` unless it returns false. `colorPalette="danger"` for
// one that deletes, `isSelected` for the current choice, `isHeader` for the row that leads back
// out of a panel (Filter).
export default function MenuOption({ onPress, label, icon, trailing, colorPalette, isSelected = false, isHeader }) {
  return (
    <MenuOptionBase
      onSelect={onPress}
      style={popupMenuStyles.row}
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSelected }}
    >
      <MenuItemContent
        label={label}
        icon={icon}
        trailing={trailing}
        colorPalette={colorPalette}
        isSelected={isSelected}
        isHeader={isHeader}
      />
    </MenuOptionBase>
  );
}
