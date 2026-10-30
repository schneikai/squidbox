import { StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import MenuButton from '@/components/MenuButton';
import { colors, glass, lineHeights, typography } from '@/styles/designTokens';

/**
 * A turn in the chat as a bubble: the user's on the right in violet (`side` 'user', with the prompt
 * button's name, `label`, over the `text`), the assistant's on the left on the glass surface (`side`
 * 'assistant'); line breaks kept, the text selectable, and a ⋯ under it holding `children` (its
 * MenuOptions) when there are any.
 */
export default function ChatBubble({ side, label, text, children }) {
  const isUser = side === 'user';
  const Fill = isUser ? GradientFill : View;

  return (
    <View style={isUser ? styles.userRow : styles.assistantRow}>
      <Fill style={isUser ? [styles.bubble, styles.userCorner] : [glass, styles.bubble, styles.assistantCorner]}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]} selectable>
          {text}
        </Text>
      </Fill>
      {children && (
        <MenuButton size="small" accessibilityLabel="More for this message" style={styles.menu}>
          {children}
        </MenuButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    paddingLeft: 48,
  },
  assistantRow: {
    alignItems: 'flex-start',
    paddingRight: 48,
  },
  bubble: {
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 4,
  },
  // The corner that points at the speaker's side.
  userCorner: {
    borderBottomRightRadius: 4,
  },
  assistantCorner: {
    borderBottomLeftRadius: 4,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text.inverse,
    opacity: 0.8,
  },
  // The chat's message size, the same as the options' cards and the composer.
  text: {
    fontSize: typography.body,
    lineHeight: lineHeights.reading,
  },
  userText: {
    color: colors.text.inverse,
  },
  assistantText: {
    color: colors.text.primary,
  },
  // Close under the bubble: the button's tap target overlaps the gap above it.
  menu: {
    marginTop: -6,
    marginBottom: -10,
  },
});
