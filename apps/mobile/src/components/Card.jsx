import { View, StyleSheet } from 'react-native';

import { colors, glass, radii } from '@/styles/designTokens';

// The selected card's glow around it.
const RING = 3;

/**
 * The standard bordered glass surface.
 * Replaces repeated `...glass + borderRadius: radii.card` in content containers.
 * `isSelected` (true or false) makes it one of a set the user picks among, like the post editor's
 * cards: the selected one gets an accent border and a soft accent glow around it. A selectable card
 * keeps the glow's room either way, so nothing moves when the selection does. Keep passing a boolean
 * while the card can ever be selected: going from undefined to a boolean remounts its content.
 *
 * Use for: content cards, input areas, media frames.
 * Do NOT use for: toolbars, chat bubbles, floating pills, borderless glass surfaces.
 */
export default function Card({ children, isSelected, style, ...rest }) {
  const card = (
    <View style={[styles.card, isSelected && styles.cardSelected, style]} {...rest}>
      {children}
    </View>
  );

  if (isSelected === undefined) return card;
  return <View style={[styles.ring, isSelected && styles.ringSelected]}>{card}</View>;
}

const styles = StyleSheet.create({
  card: {
    ...glass,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: colors.accent.border,
  },
  ring: {
    margin: -RING,
    padding: RING,
    borderRadius: radii.card + RING,
  },
  ringSelected: {
    backgroundColor: colors.accent.light,
  },
});
