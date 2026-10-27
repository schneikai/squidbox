import { StyleSheet, Text, View } from 'react-native';

import useCopyText from './useCopyText';

import IconMenuButton from '@/components/IconMenuButton';
import MenuOption from '@/components/popup-menu-options/MenuOption';
import { colors, glass, lineHeights, sizes, typography } from '@/styles/designTokens';

/**
 * What the assistant says in the chat (`text`): a bubble on the left on the glass surface (the violet
 * one is the user's), its line breaks kept, and a ⋯ under it to copy it (a bio or a profile text).
 */
export default function AssistantBubble({ text }) {
  const copy = useCopyText();

  return (
    <View style={styles.message}>
      <View style={[glass, styles.bubble]}>
        <Text style={styles.text} selectable>
          {text}
        </Text>
      </View>
      <IconMenuButton
        size={sizes.iconSmall}
        color={colors.text.secondary}
        accessibilityLabel="More for this message"
        style={styles.menu}
      >
        <MenuOption label="Copy" icon="copy" onPress={() => copy(text)} />
      </IconMenuButton>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    alignItems: 'flex-start',
    paddingRight: 48,
  },
  bubble: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  text: {
    fontSize: typography.subheadline,
    lineHeight: lineHeights.subheadline,
    color: colors.text.primary,
  },
  // Close under the bubble: the button's tap target overlaps the gap above it.
  menu: {
    marginTop: -6,
    marginBottom: -10,
  },
});
