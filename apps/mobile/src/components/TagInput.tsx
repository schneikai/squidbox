import { type ComponentRef, useRef } from 'react';
import { Pressable, type TextInput as RNTextInput, StyleSheet } from 'react-native';

import TextInput, { type TextInputProps } from '@/components/TextInput';
import chipFrame from '@/styles/chipFrame';
import { colors, typography } from '@/styles/designTokens';

export type TagInputProps = Required<Pick<TextInputProps, 'value' | 'onChangeText'>> &
  Pick<TextInputProps, 'maxLength'> & { onSubmit: () => void; onBlur: () => void };

// The input that stands in for a chip while a tag is typed: a Chip's frame with a thicker accent
// border, so it reads as the field being typed in.
// The pill is a box of its own, centring an input of one line's height: iOS places a text field's
// placeholder lower than its caret when the field is taller than its line, so the input itself is
// never stretched to the chip's height. A tap anywhere on the pill focuses it.
// Return adds the tag and keeps it open for the next one; a tag is at most `maxLength` long.
export default function TagInput({ value, onChangeText, onSubmit, onBlur, maxLength }: TagInputProps) {
  const inputRef = useRef<ComponentRef<typeof RNTextInput>>(null);

  return (
    <Pressable accessible={false} onPress={() => inputRef.current?.focus()} style={[chipFrame, styles.pill]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onBlur={onBlur}
        submitBehavior="submit"
        // react-native-web knows only the older prop.
        blurOnSubmit={false}
        returnKeyType="done"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={maxLength}
        placeholder="Tag"
        style={styles.input}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 96,
    borderWidth: 1.5,
    borderColor: colors.accent.base,
  },
  input: {
    padding: 0,
    fontSize: typography.subheadline, // no line height in a one-line input (TextInput)
  },
});
