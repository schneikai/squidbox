import { ScrollView, StyleSheet } from 'react-native';

import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import { SCREEN_PADDING } from '@/constants';
import { colors, sizes } from '@/styles/designTokens';

/**
 * The prompt buttons under a reply (`buttons`), side by side, scrolling sideways when they don't fit:
 * a tap sends the button's prompt (`onSend(button)`); the pencil edits them (`onEdit`).
 */
export default function RefineRow({ buttons, onSend, onEdit }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {buttons.map((button) => (
        <Chip
          key={button.id}
          label={button.name}
          icon={button.icon}
          variant="outlined"
          onPress={() => onSend(button)}
        />
      ))}
      <IconButton
        icon="pencil"
        size={sizes.iconSmall}
        color={colors.text.secondary}
        onPress={onEdit}
        accessibilityLabel="Edit the Refine buttons"
      />
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
