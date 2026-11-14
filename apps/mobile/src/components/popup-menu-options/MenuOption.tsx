import type { ViewProps } from 'react-native';
import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent, { type MenuItemContentProps } from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

// The library forwards these to the option's touchable (MenuOption.js spreads its other props), but
// its d.ts leaves them out.
declare module 'react-native-popup-menu' {
  interface MenuOptionProps {
    'aria-selected'?: ViewProps['aria-selected'];
    'aria-checked'?: ViewProps['aria-checked'];
    'aria-disabled'?: ViewProps['aria-disabled'];
  }
}

// `onPress` is the library's `onSelect`: a false result keeps the menu open.
export type MenuOptionProps = MenuItemContentProps & { onPress?: () => unknown; isDisabled?: boolean };

// A disabled row's press: nothing, and the menu stays open.
const stayOpen = () => false;

// A menu row. The menu closes after `onPress` unless it returns false. `colorPalette="danger"` for
// one that deletes, `isSelected` for the current choice, with `selection` the mark it shows
// (MenuItemContent): a check in a pick-one menu (a `menuitem`, selected), a select circle in a
// pick-several one (a checkbox, checked; react-native has no `menuitemcheckbox` role). `isDisabled`
// dims it and makes a press do nothing, keeping its role and state (the library's `disabled` would
// draw it as a plain view without them). `isHeader` for the row that leads back out of a panel
// (Filter), `leading` a mark before the label.
export default function MenuOption({
  onPress,
  label,
  icon,
  leading,
  trailing,
  colorPalette,
  isSelected = false,
  selection = 'one',
  isDisabled = false,
  isHeader,
}: MenuOptionProps) {
  const isSeveral = selection === 'several';
  return (
    <MenuOptionBase
      onSelect={isDisabled ? stayOpen : onPress}
      style={[popupMenuStyles.row, isDisabled && popupMenuStyles.disabledRow]}
      accessibilityRole={isSeveral ? 'checkbox' : 'menuitem'}
      aria-selected={isSeveral ? undefined : isSelected}
      aria-checked={isSeveral ? isSelected : undefined}
      aria-disabled={isDisabled || undefined}
    >
      <MenuItemContent
        label={label}
        icon={icon}
        leading={leading}
        trailing={trailing}
        colorPalette={colorPalette}
        isSelected={isSelected}
        selection={selection}
        isHeader={isHeader}
      />
    </MenuOptionBase>
  );
}
