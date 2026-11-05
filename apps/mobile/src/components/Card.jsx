import { View, StyleSheet } from 'react-native';

import { colors, layout, radii, shadows } from '@/styles/designTokens';

/**
 * The standard card: an opaque white surface resting on the page with a soft shadow, no border.
 *
 * Use for: content cards, input areas, media frames.
 * Do NOT use for: toolbars, chat bubbles, floating pills (FloatingPill).
 * `padded` gives it a card's inset and the gap between its parts (content cards); without it the
 * content reaches the edges (media frames, inputs).
 */
export default function Card({ padded = false, children, style, ...rest }) {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...rest}>
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
  padded: {
    padding: layout.cardInset,
    gap: layout.cardGap,
  },
});
