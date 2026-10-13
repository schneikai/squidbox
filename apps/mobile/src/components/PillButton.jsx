import { Pressable, StyleSheet } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

// An icon button inside a floating pill (headers and action bars).
export default function PillButton({ iconName, onPress, disabled, danger, active }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        pressed && { backgroundColor: colors.pressedBg },
        disabled && styles.disabled,
      ]}
    >
      <Icon name={iconName} color={active ? colors.accent : danger ? colors.danger : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.35,
  },
});
