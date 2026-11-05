import { LinearGradient } from 'expo-linear-gradient';
import type { ViewProps } from 'react-native';

import { colors } from '@/styles/designTokens';

const START = { x: 0, y: 0 };
const END = { x: 1, y: 1 };

export type GradientFillProps = Pick<ViewProps, 'style' | 'children'>;

// The violet gradient of a primary action, filling its button.
export default function GradientFill({ style, children }: GradientFillProps) {
  return (
    <LinearGradient colors={colors.accent.gradient} start={START} end={END} style={style}>
      {children}
    </LinearGradient>
  );
}
