import { ScrollView, StyleSheet } from 'react-native';

import PromptButtonChip from './PromptButtonChip';

/**
 * The prompt buttons (`buttons`) on one line, scrolling sideways when they don't fit: a tap calls
 * `onPress(button)`. `leading` goes before the buttons (Ask anything), `children` after them (the
 * pen). `chipVariant` is the buttons' Chip variant (PromptButtonChip). The parent sets the line's
 * place through `style` and the chips' inset through `contentContainerStyle`.
 */
export default function PromptButtonRow({
  buttons,
  chipVariant,
  onPress,
  leading,
  children,
  style,
  contentContainerStyle,
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={[styles.row, contentContainerStyle]}
    >
      {leading}
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} variant={chipVariant} onPress={onPress} />
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
