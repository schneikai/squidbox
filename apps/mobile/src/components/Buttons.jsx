import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, scale } from '@/styles/designTokens';

export function Button({ title, onPress, disabled, variant = 'default', style = {} }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonPrimaryText,
          variant === 'danger' && styles.buttonDangerText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    borderRadius: radii.card,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: scale(15),
    color: colors.text,
  },

  buttonPrimary: {
    borderColor: colors.accent,
    backgroundColor: colors.accentLight,
  },
  buttonPrimaryText: {
    color: colors.accent,
  },

  buttonDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  buttonDangerText: {
    color: colors.danger,
  },
});
