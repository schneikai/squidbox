import { useContext } from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';

import AssistantTrayContext from '@/components/AssistantTrayContext';
import InkContext, { DEFAULT_INK } from '@/components/InkContext';
import { colors, layout, radii, shadows } from '@/styles/designTokens';

export type CardProps = ViewProps & {
  padded?: boolean;
  hasControlRow?: boolean;
};

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
export default function Card({ padded = false, hasControlRow = false, children, style, ...rest }: CardProps) {
  // On the assistant's tray a card rests flat: the tray clips what it holds, so a shadow would be cut.
  const isOnTray = useContext(AssistantTrayContext) !== null;

  return (
    <View
      style={[
        styles.card,
        isOnTray && shadows.none,
        padded && styles.padded,
        hasControlRow && styles.controlRow,
        style,
      ]}
      {...rest}
    >
      {/* White again: its content takes the default ink, also on a tinted surface. */}
      <InkContext.Provider value={DEFAULT_INK}>{children}</InkContext.Provider>
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
