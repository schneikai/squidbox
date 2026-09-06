import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors } from '@/styles/designTokens';

/**
 * Standard screen root wrapper.
 *
 * Provides the app gradient background and flex: 1 so that every screen
 * pushed onto a stack has an opaque surface — preventing the previous screen
 * from bleeding through during navigation animations.
 *
 * Padding and scrolling are intentionally left to the screen itself via
 * useScreenPadding, since they vary per context.
 */
export default function Page({ children, style }) {
  return (
    <LinearGradient colors={colors.appBackground} style={[styles.root, style]}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
