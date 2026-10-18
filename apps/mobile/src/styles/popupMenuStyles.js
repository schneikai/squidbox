import { colors, spacing } from '@/styles/designTokens';

/**
 * Shared styles for react-native-popup-menu components.
 * Used alongside BlurPopoverRenderer which handles the container shell
 * (background, border-radius, blur, shadow, positioning).
 */
export default {
  // Passed to <MenuOptions customStyles={...}>. Background is transparent — BlurPopoverRenderer
  // provides the surface. Everything that affects the menu's SIZE lives here, because the library
  // measures the options with this style before BlurPopoverRenderer draws them; sizing styles on
  // the renderer alone make the measured box smaller than the drawn one. The width is fixed (not
  // sized to content), so labels are laid out at their final width in one pass and a label that
  // still wraps is measured with all its lines.
  menuOptions: {
    optionsContainer: {
      backgroundColor: 'transparent',
      width: spacing.popoverWidth,
      paddingVertical: spacing.barPaddingY,
      borderWidth: 1,
      borderColor: colors.menuBorder,
    },
  },

  // Applied to each <MenuOption style={...}>
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.menuRowH,
    paddingVertical: spacing.menuRowV,
    borderBottomWidth: 1,
    borderBottomColor: colors.menuBorder,
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
    color: colors.menuText,
  },
  menuOptionTextDanger: {
    color: colors.danger,
  },

  // Leading icon (left of label)
  menuOptionIcon: {
    marginRight: spacing.menuIconGap,
    width: spacing.menuIconSize,
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
