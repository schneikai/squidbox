import RNMaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType, ReactElement } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';

import { colors } from '@/styles/designTokens';

// The package types its class through a NativeMethods mixin that current React types don't accept as
// a JSX component: typed here by its props.
const MaskedView = RNMaskedView as unknown as ComponentType<ViewProps & { maskElement: ReactElement }>;

// The mask: the blur at full strength behind the header, fading out below it.
const MASK = (
  <LinearGradient colors={['black', 'black', 'transparent']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
);
// A veil of the page's color over the blur, stronger at the top, so the title reads on it.
const VEIL_COLORS = [colors.background.edgeVeil, colors.background.baseClear] as const;

/** What ScrollEdgeFade draws: the blur, masked to fade out downwards, under the page-colored veil. It fills its parent. */
export default function ScrollEdgeSurface() {
  return (
    <MaskedView style={StyleSheet.absoluteFill} maskElement={MASK}>
      <BlurView intensity={18} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient colors={VEIL_COLORS} style={StyleSheet.absoluteFill} />
    </MaskedView>
  );
}
