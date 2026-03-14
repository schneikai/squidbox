import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';

import { glass, radii, shadows } from '@/styles/designTokens';

/**
 * Base frosted-glass pill container used by all three floating bars.
 * Wraps content in a BlurView + border + shadow.
 */
export default function FloatingPill({ children, style }) {
  return (
    <View style={[styles.shadow, style]}>
      <BlurView intensity={80} tint="light" style={styles.blur}>
        <View style={styles.surface}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.pill,
    ...shadows.floating,
  },
  blur: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  surface: {
    ...glass,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
