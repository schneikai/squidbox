import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

/**
 * The prompt buttons (`buttons`) on one line, scrolling sideways when they don't fit: a tap calls
 * `onPress(button)`. `children` follow the buttons (Ask anything, the pen). The parent sets the
 * line's place through `style` and the chips' inset through `contentContainerStyle`.
 */
export default function PromptButtonRow({ buttons, onPress, children, style, contentContainerStyle }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={[styles.row, contentContainerStyle]}
    >
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} onPress={onPress} />
      ))}
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 8,
  },
});
