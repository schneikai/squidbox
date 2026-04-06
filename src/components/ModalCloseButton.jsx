import { Pressable } from 'react-native';

import Icon from '@/components/Icon';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors } from '@/styles/designTokens';

/**
 * Standard × close / dismiss button for modal headers.
 * Renders a raw pressable — ModalHeader wraps it in FloatingPill automatically.
 */
export default function ModalCloseButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionButtonStyles.pillButton,
        pressed && { backgroundColor: colors.pressedBg },
      ]}
      hitSlop={8}
    >
      <Icon name="close" color={colors.text} />
    </Pressable>
  );
}
