import { ScrollView, StyleSheet } from 'react-native';

import { SCREEN_PADDING } from '@/constants';
import EditPromptButtonsButton from '@/features/prompt-buttons/EditPromptButtonsButton';
import PromptButtonChip from '@/features/prompt-buttons/PromptButtonChip';

/**
 * The prompt buttons under a reply (`buttons`), side by side, scrolling sideways when they don't fit:
 * a tap sends the button's prompt (`onSend(button)`); the pencil edits them.
 */
export default function RefineRow({ buttons, onSend }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {buttons.map((button) => (
        <PromptButtonChip key={button.id} button={button} onPress={onSend} />
      ))}
      <EditPromptButtonsButton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Edge to edge, the chips starting in line with the transcript.
  scroll: {
    marginHorizontal: -SCREEN_PADDING,
  },
  row: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
  },
});
