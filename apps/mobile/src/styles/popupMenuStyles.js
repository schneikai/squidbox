import { colors, radii, spacing } from '@/styles/designTokens';

/**
 * Shared styles for react-native-popup-menu components.
 * Used alongside BlurPopoverRenderer which handles the container shell
 * (background, border-radius, blur, shadow, positioning).
 */
export default {
  // Passed to <MenuOptions customStyles={...}>. Background is transparent — BlurPopoverRenderer
  // provides the surface. Everything that affects the menu's SIZE lives here, because the library
  // measures the options with this style before BlurPopoverRenderer draws them; sizing styles on
  // the renderer alone make the measured box smaller than the drawn one.
  menuOptions: {
    optionsContainer: {
      backgroundColor: 'transparent',
      minWidth: 200, // fits ~6 chars label + icon; expands with content
      paddingVertical: spacing.barPaddingY,
      borderWidth: 1,
      borderColor: colors.darkModalBorder,
    },
  },

  // Applied to each <MenuOption style={...}>
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.menuRowH,
    paddingVertical: spacing.menuRowV,
    borderBottomWidth: 1,
    borderBottomColor: colors.darkModalBorder,
  },
  menuOptionLast: {
    borderBottomWidth: 0,
  },

  // Applied to the <Text> inside each option. Grows to push trailing icons/dots right, but keeps
  // its natural width as the basis: with `flex: 1` (basis 0) the auto-sized menu ignores label
  // widths, so long labels wrap after the menu's height was measured and the last row is cut off.
  menuOptionText: {
    flexGrow: 1,
    flexShrink: 1,
    fontSize: spacing.menuFontSize,
    fontWeight: '500',
    color: colors.darkModalText,
  },
  menuOptionTextDanger: {
    color: colors.danger,
  },

  // Leading icon (left of label)
  menuOptionIcon: {
    marginRight: spacing.menuIconGap,
    width: spacing.menuIconSize,
  },

  // Trigger wrapper — round shape, clips the TouchableHighlight press state
  menuTrigger: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Trailing active dot shown on the right of an active menu option
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
};
