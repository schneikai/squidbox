import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import TextInput, { type TextInputProps } from '@/components/TextInput';
import { colors, FONT_LINE, lineHeights, typography } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

export type FoldingTextInputProps = TextInputProps & {
  foldedLines: number;
  editHint?: string;
  isInitiallyEditing?: boolean;
};

/**
 * A multiline TextInput (`style` its box: padding, flex, sizes) that shows only its first `foldedLines` lines while it isn't being edited, so a long
 * text doesn't take the screen; a tap opens it for typing, and leaving it folds it again.
 * `editHint` says what the tap edits, for a screen reader. `isInitiallyEditing` opens it for typing
 * when it mounts (a text just put there to edit and send). The other props are the TextInput's.
 */
export default function FoldingTextInput({
  foldedLines,
  editHint,
  isInitiallyEditing = false,
  value,
  placeholder,
  minHeight,
  style,
  onBlur,
  ...rest
}: FoldingTextInputProps) {
  const [isEditing, setIsEditing] = useState(isInitiallyEditing);

  const handleBlur: TextInputProps['onBlur'] = (event) => {
    setIsEditing(false);
    onBlur?.(event);
  };

  if (isEditing) {
    return (
      <TextInput
        multiline
        value={value}
        placeholder={placeholder}
        minHeight={minHeight}
        style={[style, Platform.OS === 'ios' && foldedLines === 1 && styles.iosEditing]}
        onBlur={handleBlur}
        autoFocus
        {...rest}
      />
    );
  }
  return (
    <Pressable
      onPress={() => setIsEditing(true)}
      accessibilityRole="button"
      accessibilityHint={editHint}
      style={[minHeight != null && { minHeight }, style]}
    >
      <Text style={[textareaTextStyle, !value && styles.placeholder]} numberOfLines={foldedLines}>
        {value || placeholder}
      </Text>
    </Pressable>
  );
}

// iOS draws a TextInput's caret as tall as its line and sets the text at the line's bottom, so the
// reading line height would give a tall caret and text that drops when a tap opens it for typing:
// typed, it takes the font's own line height, and the spare height goes around it as margin, so the
// field keeps its size and the text its place. Only a one-line field (a chat's composer): the margin
// makes up for one line, and a taller field would grow and its lines close up.
const IOS_SPARE_HEIGHT = lineHeights.reading - typography.body * FONT_LINE;

const styles = StyleSheet.create({
  iosEditing: {
    lineHeight: undefined,
    marginVertical: IOS_SPARE_HEIGHT / 2,
  },
  placeholder: {
    color: colors.text.tertiary,
  },
});
