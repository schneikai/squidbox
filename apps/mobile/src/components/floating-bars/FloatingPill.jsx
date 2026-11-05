import { BlurView } from 'expo-blur';
import { Children, isValidElement } from 'react';
import { StyleSheet, View } from 'react-native';

import FadedGroupContext from '@/components/FadedGroupContext';
import IconSlotContext from '@/components/IconSlotContext';
import { colors, disabledOpacity, layout, litGlass, radii, shadows } from '@/styles/designTokens';

/**
 * A toolbar: the frosted-glass pill that groups the buttons that belong together, one button tall
 * with a thin frame around them. Wraps content in a BlurView with a soft shadow and a lit edge
 * (shadows.litEdge) drawn inside it, no border. Its tertiary icon buttons each take a 44 pt slot
 * (IconSlotContext), so their icons sit apart like discs. A toolbar that is only the primary button
 * is violet instead of glass, so it reads as one bigger button with the same rim (shadows.litEdgeAccent),
 * and while that button is off the whole toolbar fades as one, rim and shadow too.
 */
export default function FloatingPill({ children, style }) {
  const buttons = Children.toArray(children);
  const isOnlyPrimary = buttons.length === 1 && isValidElement(buttons[0]) && buttons[0].props.variant === 'primary';

  if (isOnlyPrimary) {
    const isOff = buttons[0].props.disabled || buttons[0].props.loading;
    return (
      <View style={[styles.shadow, isOff && styles.off, style]}>
        <View style={[styles.surface, styles.primarySurface]}>
          <FadedGroupContext.Provider value>{children}</FadedGroupContext.Provider>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.shadow, style]}>
      <BlurView intensity={80} tint="light" style={styles.blur}>
        <View style={styles.surface}>
          <IconSlotContext.Provider value>{children}</IconSlotContext.Provider>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.pill,
    ...shadows.floating,
    flexShrink: 1,
  },
  primarySurface: {
    backgroundColor: colors.accent.frame,
    ...shadows.litEdgeAccent,
  },
  // Faded as one, so the rim doesn't stay bright around a faded button (the button doesn't fade itself).
  off: {
    opacity: disabledOpacity,
  },
  blur: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  surface: {
    ...litGlass,
    ...shadows.litEdge,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.toolbarFrame,
    flexShrink: 1,
  },
});
