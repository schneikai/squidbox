// Popover menu system 1 of 2 — trigger-anchored contextual menus.
// Uses react-native-popup-menu with a custom BlurPopoverRenderer that measures
// the trigger button's screen position to place the panel nearby.
// Good for: flat action lists tied to a specific button (3-dot menus, add menus).
//
// TODO: Consider unifying with SortFilterModal into a single popover system.
// The main obstacle is that react-native-popup-menu doesn't support sub-panel
// navigation out of the box (needed for the sort/filter drill-down).
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { Menu, MenuTrigger, MenuOptions } from 'react-native-popup-menu';

import actionButtonStyles, { menuTriggerTouchable } from '@/styles/actionButtonStyles';
import popupMenuStyles from '@/styles/popupMenuStyles';
import { colors, shadows, spacing, radii } from '@/styles/designTokens';

/**
 * Self-contained popup menu that owns all the repeated boilerplate:
 * Menu, MenuTrigger (with correct touchable + wrapper styles), and
 * MenuOptions (with default customStyles). Children are the menu options.
 *
 * variant="bar"      (default) — grey circle, used standalone in floating action bars.
 * variant="pill"               — no background, used inside a FloatingPill.
 * variant="gradient"           — purple gradient fill, used for primary add actions.
 *
 * active  — accent tint on button + icon.
 * warning — accent tint on button background (e.g. when filters are active).
 *
 * Note: Menu, MenuTrigger, and MenuOptions must remain direct JSX children of
 * <Menu> here (not wrapped in other components) so react-native-popup-menu's
 * internal type-checks and menuName injection work correctly.
 */
export default function PopupMenu({ icon, variant = 'bar', active = false, warning = false, children }) {
  const isGradient = variant === 'gradient';

  const triggerWrapper = isGradient
    ? styles.gradientWrapper
    : variant === 'pill'
      ? actionButtonStyles.pillButton
      : actionButtonStyles.button;

  return (
    <Menu>
      <MenuTrigger
        customStyles={{
          triggerWrapper: [
            triggerWrapper,
            !isGradient && active && actionButtonStyles.buttonActive,
            !isGradient && warning && actionButtonStyles.buttonWarning,
          ],
          triggerTouchable: {
            ...menuTriggerTouchable,
            underlayColor: isGradient ? 'rgba(255,255,255,0.15)' : menuTriggerTouchable.underlayColor,
          },
        }}
      >
        {isGradient ? (
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientFill}
          >
            <Ionicons name={icon} style={styles.gradientIcon} />
          </LinearGradient>
        ) : (
          <Ionicons
            name={icon}
            style={[
              actionButtonStyles.buttonIcon,
              (active || warning) && actionButtonStyles.buttonIconActive,
            ]}
          />
        )}
      </MenuTrigger>
      <MenuOptions customStyles={popupMenuStyles.menuOptions}>
        {children}
      </MenuOptions>
    </Menu>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.accent,
  },
  gradientFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientIcon: {
    fontSize: 20,
    color: colors.iconActive,
  },
});
