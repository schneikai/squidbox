import { TextInput as RNTextInput } from 'react-native';

import { colors } from '@/styles/designTokens';
import textareaTextStyle from '@/styles/textareaTextStyle';

/**
 * Multiline free-text input.
 * Sibling to TextInput — both wrap RN's TextInput with the same color and typography
 * defaults. Textarea additionally sets multiline, textAlignVertical, and lineHeight.
 * It does not compose or inherit from the TextInput component.
 *
 * style applies to the input element directly (no container).
 * Pass flex, padding, minHeight, etc. via style as needed by the caller.
 *
 * It grows with its text and doesn't scroll itself, so a drag that starts on it scrolls the screen
 * around it, and only a tap starts editing, as in Notes. One capped with a maxHeight passes
 * `scrollEnabled` to scroll its text inside.
 */
export default function Textarea({ style, minHeight, scrollEnabled = false, ...rest }) {
  return (
    <RNTextInput
      multiline
      scrollEnabled={scrollEnabled}
      textAlignVertical="top"
      placeholderTextColor={colors.text.tertiary}
      style={[textareaTextStyle, minHeight != null && { minHeight }, style]}
      {...rest}
    />
  );
}
