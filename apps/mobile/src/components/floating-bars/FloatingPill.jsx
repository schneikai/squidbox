import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import useTiltStyles from './useTiltStyles';

import IconSlotContext from '@/components/IconSlotContext';
import { layout, litGlass, radii } from '@/styles/designTokens';

/**
 * A toolbar: the frosted-glass pill that groups the buttons that belong together, one button tall
 * with a thin frame around them. Wraps content in a BlurView with a soft shadow and a lit edge
 * (tilt.litEdge) drawn inside it, no border; it tilts with the phone (useTiltStyles). Its tertiary icon buttons each take a 44 pt slot
 * (IconSlotContext), so their icons sit apart like discs.
 */
export default function FloatingPill({ children, style }) {
  const { lift, rim } = useTiltStyles();

  return (
    <Animated.View style={[styles.shadow, lift, style]}>
      <BlurView intensity={80} tint="light" style={styles.blur}>
        <Animated.View style={[styles.surface, rim]}>
          <IconSlotContext.Provider value>{children}</IconSlotContext.Provider>
        </Animated.View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radii.pill,
    flexShrink: 1,
  },
  blur: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  surface: {
    ...litGlass,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    padding: layout.toolbarFrame,
    flexShrink: 1,
  },
});
