import { StyleSheet } from 'react-native';

import { colors, spacing, radii } from '@/styles/designTokens';

/**
 * Props to pass to MenuTrigger's triggerTouchable so the TouchableHighlight
 * that the library renders is itself clipped to a circle.
 *
 * The triggerWrapper style (applied to the inner View) doesn't clip the outer
 * touchable's underlay — this style object targets the TouchableHighlight itself.
 */
export const menuTriggerTouchable = {
  underlayColor: 'rgba(0,0,0,0.06)',
  style: {
    borderRadius: spacing.iconButtonSize / 2,
    overflow: 'hidden',
  },
};

/**
 * Shared styles for inline action button components (sort, filter, search icons)
 * used in picker headers and the old-style header actions.
 */
export default StyleSheet.create({
  button: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  // Used inside a FloatingPill — same shape as button but no background,
  // since the pill already provides the visual container.
  pillButton: {
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: colors.accentLight,
  },
  buttonWarning: {
    backgroundColor: colors.accentLight,
  },
  buttonDanger: {
    backgroundColor: colors.dangerLight,
  },
  buttonIcon: {
    fontSize: 20,
    color: colors.text,
  },
  buttonIconActive: {
    color: colors.accent,
  },
  buttonIconDanger: {
    color: colors.danger,
  },
});
