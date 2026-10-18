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
 */
export default function Textarea({ style, minHeight, ...rest }) {
  return (
    <RNTextInput
      multiline
      textAlignVertical="top"
      placeholderTextColor={colors.textTertiary}
      style={[textareaTextStyle, minHeight != null && { minHeight }, style]}
      {...rest}
    />
  );
}
