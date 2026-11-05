import { View, StyleSheet } from 'react-native';

import { colors, layout, radii, shadows } from '@/styles/designTokens';

/**
 * The standard card: an opaque white surface resting on the page with a soft shadow, no border.
 *
 * Use for: content cards, input areas, media frames.
 * Do NOT use for: toolbars, chat bubbles, floating pills (FloatingPill).
 * `padded` gives it a card's inset and the gap between its parts (content cards); without it the
 * content reaches the edges (media frames, inputs). `hasControlRow`, on a padded card that ends in
 * a row of 44 pt controls (a toolbar, a chat option's actions), lets that row's own room make up
 * the inset under it and the gap above it, so its glyphs sit cardGap from the text and cardInset
 * from the edge.
 */
export default function Card({ padded = false, hasControlRow = false, children, style, ...rest }) {
  return (
    <View style={[styles.card, padded && styles.padded, hasControlRow && styles.controlRow, style]} {...rest}>
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
  controlRow: {
    paddingBottom: layout.controlRowSlack,
    gap: layout.controlRowSlack,
  },
});
