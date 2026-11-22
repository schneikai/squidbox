import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors } from '@/styles/designTokens';

// The veil alone: MaskedView's web build draws only its mask, not what it masks, so the web has no blur here.
const VEIL_COLORS = [colors.background.edgeVeil, colors.background.baseClear] as const;

/** ScrollEdgeFade's surface on the web: the page-colored veil, fading out downwards. It fills its parent. */
export default function ScrollEdgeSurface() {
  return <LinearGradient colors={VEIL_COLORS} style={StyleSheet.absoluteFill} />;
}
