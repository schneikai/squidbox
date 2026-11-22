import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { type LayoutChangeEvent, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { litGlass, shadows } from '@/styles/designTokens';

type GlassSurfaceProps = {
  radius: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: ReactNode;
};

/**
 * Frosted glass floating over the screen (a toolbar's pill, the chat's composer): what is behind
 * it blurred, a soft shadow, and a lit edge drawn inside it, no border, rounded by `radius`. `style`
 * places it (the parent's layout), `contentStyle` lays out what is on it.
 */
export default function GlassSurface({ radius, style, contentStyle, onLayout, children }: GlassSurfaceProps) {
  const rounded = { borderRadius: radius };

  return (
    <View style={[rounded, shadows.floating, style]} onLayout={onLayout}>
      <BlurView intensity={80} tint="light" style={[rounded, styles.blur]}>
        <View style={[litGlass, shadows.litEdge, rounded, contentStyle]}>{children}</View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
  },
});
