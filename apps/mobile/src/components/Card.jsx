import { View, StyleSheet } from 'react-native';

import { colors, radii, shadows } from '@/styles/designTokens';

/**
 * The standard bordered glass surface.
 * Replaces repeated `...glass + borderRadius: radii.card` in content containers.
 *
 * Use for: content cards, input areas, media frames.
 * Do NOT use for: toolbars, chat bubbles, floating pills, borderless glass surfaces.
 */
export default function Card({ children, style, ...rest }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radii.card,
    ...shadows.card,
    overflow: 'hidden',
  },
});
