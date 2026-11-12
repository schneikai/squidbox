import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import Card from '@/components/Card';
import Text from '@/components/Text';
import { colors } from '@/styles/designTokens';

export type OptionCardProps = {
  text: string;
  textSize?: 'regular' | 'small';
  isUsed?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * One post the assistant wrote: its text, and under it the row of actions in `children` when given
 * (the chat's More like this and Use or Copy); without them the text alone (a reply Verify shows).
 * It fills the height its parent gives it, the actions at its end, so the cards of one row line up
 * (a carousel of ideas). `textSize="small"` for the tray's carousel, where many sit side by side.
 * `isUsed` marks the idea the user put in their post with a light violet outline.
 * style is for layout only.
 */
export default function OptionCard({ text, textSize = 'regular', isUsed = false, children, style }: OptionCardProps) {
  const hasActions = children != null;

  return (
    <Card padded hasControlRow={hasActions} style={[isUsed && styles.used, style]}>
      <Text selectable size={textSize}>
        {text}
      </Text>
      {hasActions && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  // Drawn inside the card's edge, so its text keeps its width and doesn't reflow.
  used: {
    outlineWidth: 2,
    outlineOffset: -2,
    outlineStyle: 'solid',
    outlineColor: colors.accent.outline,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    // eslint-disable-next-line no-restricted-syntax -- pulls the first icon button's glyph to the text's edge
    marginLeft: -10,
  },
});
