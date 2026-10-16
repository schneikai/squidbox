import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, scale } from '@/styles/designTokens';

// A secondary action as a line of text ("Sign in as someone else", "Try again"): accent-colored,
// or `muted` for one that should not draw the eye.
export default function TextButton({ label, onPress, muted = false }) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onPress} hitSlop={8}>
      <Text style={[styles.label, muted && styles.muted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  pressed: { opacity: 0.6 },
  label: { color: colors.accent, fontSize: scale(15), fontWeight: '500' },
  muted: { color: colors.textSecondary, fontWeight: '400' },
});
