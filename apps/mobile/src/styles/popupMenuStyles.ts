import type { ViewStyle } from 'react-native';

import { disabledOpacity, layout, sizes } from '@/styles/designTokens';

// Everything that affects a popover's SIZE. Menus pass it to <MenuOptions> through `menuOptions`,
// because the library measures the options with that style before BlurPopoverRenderer draws them;
// sizing styles on the renderer alone make the measured box smaller than the drawn one. The width is
// fixed (not sized to content), so labels are laid out at their final width in one pass and a label
// that still wraps is measured with all its lines.
const frame = {
  width: sizes.popoverWidth,
};

export default {
  // Passed to <MenuOptions customStyles={...}>. Transparent: PopoverSurface draws the surface.
  menuOptions: {
    optionsContainer: { ...frame, backgroundColor: 'transparent' },
  },

  // One row of a popover, around MenuItemContent.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.menuRowPaddingX,
    paddingVertical: layout.menuRowPaddingY,
    minHeight: layout.menuRowHeight, // above Apple's 44 pt target; a larger text size grows the row
  } satisfies ViewStyle,

  // A row that can't be picked now (MenuOption's `isDisabled`), dimmed whole.
  disabledRow: { opacity: disabledOpacity } satisfies ViewStyle,
};
