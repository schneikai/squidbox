import { StyleSheet } from 'react-native';

import TextInput from '@/components/TextInput';
import chipFrame from '@/styles/chipFrame';
import { colors, typography } from '@/styles/designTokens';

// The input that stands in for a chip while a tag is typed: a Chip's frame with a thicker accent
// border, so it reads as the field being typed in.
// Return adds the tag and keeps it open for the next one; a tag is at most `maxLength` long.
export default function TagInput({ value, onChangeText, onSubmit, onBlur, maxLength }) {
  return (
    <TextInput
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
      style={[chipFrame, styles.input]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minWidth: 96,
    paddingVertical: 0,
    borderWidth: 1.5,
    borderColor: colors.accent.base,
    fontSize: typography.subheadline,
  },
});
