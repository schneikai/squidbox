import { StyleSheet } from 'react-native';

import { colors, spacing, radii } from '@/styles/designTokens';

/**
 * Shared button shapes: `pillButton` is the 44pt round tap target of every IconButton; `button`
 * adds a grey fill for a round button on its own.
 */
export default StyleSheet.create({
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pressedBg,
  },
  pillButton: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // iOS hairline divider between rows in a grouped list/settings section
  listDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: spacing.floatingBarSide,
  },
});
