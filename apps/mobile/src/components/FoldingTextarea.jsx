import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import Textarea from '@/components/Textarea';
import { colors } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

/**
 * A Textarea (`style` its box: padding, flex, sizes) that shows only its first `foldedLines` lines while it isn't being edited, so a long
 * text doesn't take the screen; a tap opens it for typing, and leaving it folds it again.
 * `editHint` says what the tap edits, for a screen reader. The other props are the Textarea's.
 */
export default function FoldingTextarea({
  foldedLines,
  editHint,
  value,
  placeholder,
  minHeight,
  style,
  onBlur,
  ...rest
}) {
  const [isEditing, setIsEditing] = useState(false);

  function handleBlur(event) {
    setIsEditing(false);
    onBlur?.(event);
  }

  if (isEditing) {
    return (
      <Textarea
        value={value}
        placeholder={placeholder}
        minHeight={minHeight}
        style={style}
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

const styles = StyleSheet.create({
  placeholder: {
    color: colors.text.tertiary,
  },
});
