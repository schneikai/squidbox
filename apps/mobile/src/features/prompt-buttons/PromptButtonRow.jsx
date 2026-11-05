import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

import { scale } from '@/styles/designTokens';

// Room above and below the chips for their shadow, which the row takes back so it stays their height.
const SHADOW_ROOM = scale(4);

/**
 * The prompt buttons (`buttons`) as lifted chips on one line, scrolling sideways when they don't fit:
 * a tap calls `onPress(button)`. `leading` goes before the buttons (Ask anything), `children` after
 * them (the pen). The row fills its parent's width, so the chips scroll under its edges; `inset` is
 * the chips' distance from those edges.
 */
export default function PromptButtonRow({ buttons, onPress, inset, leading, children }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={[styles.content, { paddingHorizontal: inset }]}
    >
      {leading}
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} variant="raised" onPress={onPress} />
      ))}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: -SHADOW_ROOM,
  },
  content: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: SHADOW_ROOM,
  },
});
