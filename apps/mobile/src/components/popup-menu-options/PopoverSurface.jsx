import { BlurView } from 'expo-blur';
import { Animated, StyleSheet, View } from 'react-native';

import { colors, radii, shadows } from '@/styles/designTokens';

// The frosted surface of every popover menu (BlurPopoverRenderer). `progress` (an Animated.Value
// from 0 to 1) grows it out of its `origin` corner (a CSS transform-origin, e.g. "top right") and
// fades it in early; the parent drives it and positions the surface through `style`.
export default function PopoverSurface({ progress, origin, style, children, ...props }) {
  const animatedStyle = {
    opacity: progress.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' }),
    transformOrigin: origin,
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
  };

  return (
    <Animated.View {...props} style={[styles.surface, style, animatedStyle]}>
      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'absolute',
    borderRadius: radii.modal,
    overflow: 'hidden',
    ...shadows.floating,
  },
  overlay: {
    backgroundColor: colors.background.menu,
  },
});
