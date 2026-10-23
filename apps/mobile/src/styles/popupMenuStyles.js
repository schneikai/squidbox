import { colors, spacing } from '@/styles/designTokens';

// Everything that affects a popover's SIZE. Menus pass it to <MenuOptions> through `menuOptions`,
// because the library measures the options with that style before BlurPopoverRenderer draws them;
// sizing styles on the renderer alone make the measured box smaller than the drawn one. The width is
// fixed (not sized to content), so labels are laid out at their final width in one pass and a label
// that still wraps is measured with all its lines.
const frame = {
  width: spacing.popoverWidth,
  paddingVertical: spacing.barPaddingY,
  borderWidth: 1,
  borderColor: colors.menuBorder,
};

export default {
  frame,

  // Passed to <MenuOptions customStyles={...}>. Transparent: PopoverSurface draws the surface.
  menuOptions: {
    optionsContainer: { ...frame, backgroundColor: 'transparent' },
  },

  // One row of a popover, around MenuItemContent.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.menuRowH,
    paddingVertical: spacing.menuRowV,
  },
};
