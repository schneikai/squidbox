import { View, StyleSheet } from 'react-native';

import { glass, radii } from '@/styles/designTokens';

/**
 * The standard bordered glass surface.
 * Replaces repeated `...glass + borderRadius: radii.card` in content containers.
 *
 * Use for: content cards, input areas, media frames.
 * Do NOT use for: toolbars, chat bubbles, floating pills, borderless glassSurface surfaces.
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
    ...glass,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
});
