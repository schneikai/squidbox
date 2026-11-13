import type { ViewProps } from 'react-native';
import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent, { type MenuItemContentProps } from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

// The library forwards this to the option's touchable (MenuOption.js spreads its other props), but
// its d.ts leaves it out.
declare module 'react-native-popup-menu' {
  interface MenuOptionProps {
    'aria-selected'?: ViewProps['aria-selected'];
  }
}

// `onPress` is the library's `onSelect`: a false result keeps the menu open.
export type MenuOptionProps = MenuItemContentProps & { onPress?: () => unknown };

// A menu row. The menu closes after `onPress` unless it returns false. `colorPalette="danger"` for
// one that deletes, `isSelected` for the current choice, `isHeader` for the row that leads back
// out of a panel (Filter), `leading` a mark before the label.
export default function MenuOption({
  onPress,
  label,
  icon,
  leading,
  trailing,
  colorPalette,
  isSelected = false,
  isHeader,
}: MenuOptionProps) {
  return (
    <MenuOptionBase
      onSelect={onPress}
      style={popupMenuStyles.row}
      accessibilityRole="menuitem"
      aria-selected={isSelected}
    >
      <MenuItemContent
        label={label}
        icon={icon}
        leading={leading}
        trailing={trailing}
        colorPalette={colorPalette}
        isSelected={isSelected}
        isHeader={isHeader}
      />
    </MenuOptionBase>
  );
}
