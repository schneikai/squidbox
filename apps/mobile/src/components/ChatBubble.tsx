import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import GradientFill from '@/components/GradientFill';
import MenuButton from '@/components/MenuButton';
import { colors, glass, radii, space, textStyles } from '@/styles/designTokens';

export type ChatBubbleProps = {
  side: 'user' | 'assistant';
  label?: string | null;
  /** What stands in its text: a string, or inline nodes. */
  text: ReactNode;
  /** Its copy button, under it. */
  copy?: ReactNode;
  children?: ReactNode;
};

/**
 * A turn in the chat as a bubble: the user's on the right in violet (`side` 'user', with the prompt
 * button's name, `label`, over the `text`), the assistant's on the left on the glass surface (`side`
 * 'assistant'); line breaks kept. Under it, its `copy` icon when given (without one a long press
 * selects the text) and a ⋯ holding `children` (its MenuOptions) when there are any.
 */
export default function ChatBubble({ side, label, text, copy, children }: ChatBubbleProps) {
  const isUser = side === 'user';
  const Fill = isUser ? GradientFill : View;

  return (
    <View style={isUser ? styles.userRow : styles.assistantRow}>
      <Fill style={isUser ? [styles.bubble, styles.userCorner] : [glass, styles.bubble, styles.assistantCorner]}>
        {!!label && <Text style={styles.label}>{label}</Text>}
        <Text style={[styles.text, isUser ? styles.userText : styles.assistantText]} selectable={!copy}>
          {text}
        </Text>
      </Fill>
      {(copy || children) && (
        <View style={styles.actions}>
          {copy}
          {children && (
            <MenuButton size="small" accessibilityLabel="More for this message">
              {children}
            </MenuButton>
          )}
        </View>
      )}
    </View>
  );
}

// The bubble's text inset, which its ⋯ lines up with.
const BUBBLE_PADDING_X = space.md;
// The room a bubble leaves on the other side: a width, not a step.
const OTHER_SIDE_WIDTH = 48;

const styles = StyleSheet.create({
  userRow: {
    alignItems: 'flex-end',
    paddingLeft: OTHER_SIDE_WIDTH,
  },
  assistantRow: {
    alignItems: 'flex-start',
    paddingRight: OTHER_SIDE_WIDTH,
  },
  bubble: {
    borderRadius: radii.bubble,
    paddingVertical: space.sm,
    paddingHorizontal: BUBBLE_PADDING_X,
    gap: space.xs,
  },
  // The corner that points at the speaker's side.
  userCorner: {
    borderBottomRightRadius: radii.bubbleTail,
  },
  assistantCorner: {
    borderBottomLeftRadius: radii.bubbleTail,
  },
  label: {
    ...textStyles.footnoteBold,
    color: colors.text.inverse,
    opacity: 0.8,
  },
  // The chat's message size, the same as the options' cards and the composer.
  text: textStyles.reading,
  userText: {
    color: colors.text.inverse,
  },
  assistantText: {
    color: colors.text.primary,
  },
  // Close under the bubble, its icons in line with the bubble's text.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.hair,
    marginBottom: -space.hair,
    marginHorizontal: BUBBLE_PADDING_X,
  },
});
