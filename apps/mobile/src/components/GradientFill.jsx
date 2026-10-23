import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/styles/designTokens';

const GRADIENT = [colors.gradientStart, colors.gradientEnd];
const START = { x: 0, y: 0 };
const END = { x: 1, y: 1 };

// The violet gradient of a primary action, filling its button.
export default function GradientFill({ style, children }) {
  return (
    <LinearGradient colors={GRADIENT} start={START} end={END} style={style}>
      {children}
    </LinearGradient>
  );
}
