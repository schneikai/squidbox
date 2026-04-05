import { Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import FloatingPill from '@/components/floating-bars/FloatingPill';
import actionButtonStyles from '@/styles/actionButtonStyles';
import { colors, spacing } from '@/styles/designTokens';

/**
 * Standard × close / dismiss button for modal headers.
 * Self-contained frosted-glass pill matching the back button on detail screens.
 */
export default function ModalCloseButton({ onPress }) {
  return (
    <FloatingPill>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          actionButtonStyles.pillButton,
          pressed && { backgroundColor: colors.pressedBg },
        ]}
        hitSlop={8}
      >
        <Ionicons name="close" size={spacing.iconSize} color={colors.text} />
      </Pressable>
    </FloatingPill>
  );
}
