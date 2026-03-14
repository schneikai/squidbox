import { colors, radii, spacing } from '@/styles/designTokens';

/**
 * Shared styles for react-native-popup-menu components.
 * Used alongside BlurPopoverRenderer which handles the container shell
 * (background, border-radius, blur, shadow, positioning).
 */
export default {
  // Passed to <MenuOptions customStyles={...}>
  // Background is transparent — BlurPopoverRenderer provides the surface.
  menuOptions: {
    optionsContainer: {
      backgroundColor: 'transparent',
      // paddingVertical is owned by BlurPopoverRenderer's container style
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

  // Applied to the <Text> inside each option
  menuOptionText: {
    flex: 1,
    fontSize: 14,
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
