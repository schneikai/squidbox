import { StyleSheet, View, type ViewProps } from 'react-native';
import { MenuOption as MenuOptionBase } from 'react-native-popup-menu';

import MenuItemContent, { type MenuItemContentProps } from './MenuItemContent';

import popupMenuStyles from '@/styles/popupMenuStyles';

// The library forwards these to the option's touchable (MenuOption.js spreads its other props), but
// its d.ts leaves them out.
declare module 'react-native-popup-menu' {
  interface MenuOptionProps {
    'aria-selected'?: ViewProps['aria-selected'];
    'aria-disabled'?: ViewProps['aria-disabled'];
  }
}

// `onPress` is the library's `onSelect`: a false result keeps the menu open.
export type MenuOptionProps = MenuItemContentProps & { onPress?: () => unknown };

// A menu row. The menu closes after `onPress` unless it returns false. `colorPalette="danger"` for
// one that deletes, `isSelected` for the current choice, `isHeader` for the row that leads back
// out of a panel (Filter), `leading` a mark before the label, `disabled` a choice not open now.
export default function MenuOption({
  onPress,
  label,
  icon,
  leading,
  disabled = false,
  trailing,
  colorPalette,
  isSelected = false,
  isHeader,
}: MenuOptionProps) {
  // As aria props, which the app and the web build both read. The library draws a disabled row as a
  // plain view without them, so there they go on a view around the row's contents.
  const a11y = { accessibilityRole: 'menuitem', 'aria-selected': isSelected, 'aria-disabled': disabled } as const;
  const content = (
    <MenuItemContent
      label={label}
      icon={icon}
      leading={leading}
      disabled={disabled}
      trailing={trailing}
      colorPalette={colorPalette}
      isSelected={isSelected}
      isHeader={isHeader}
    />
  );

  return (
    <MenuOptionBase onSelect={onPress} disabled={disabled} style={popupMenuStyles.row} {...(!disabled && a11y)}>
      {disabled ? (
        <View accessible {...a11y} style={styles.disabled}>
          {content}
        </View>
      ) : (
        content
      )}
    </MenuOptionBase>
  );
}

const styles = StyleSheet.create({
  // The row's line, as the library's view lays it out.
  disabled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
