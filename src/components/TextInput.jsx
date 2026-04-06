import { TextInput as RNTextInput, StyleSheet } from 'react-native';

import { colors, typography } from '@/styles/designTokens';

/**
 * Single-line text input with the app's standard typography and colors as defaults.
 * Eliminates repeating fontSize, color, and placeholderTextColor at every call site.
 *
 * Sibling to Textarea — both wrap RN's TextInput with the same styling conventions.
 * style applies to the input element directly (no container).
 *
 * Accepts and forwards all React Native TextInput props.
 */
export default function TextInput({ style, ...rest }) {
  return (
    <RNTextInput
      placeholderTextColor={colors.textTertiary}
      style={[styles.base, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: typography.input,
    color: colors.text,
  },
});
