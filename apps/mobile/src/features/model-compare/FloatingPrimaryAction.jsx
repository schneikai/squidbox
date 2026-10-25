import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout, sizes } from '@/styles/designTokens';

// The room a screen's content keeps free at the bottom for the action (plus the home indicator's
// inset, which the screen adds), like the floating bars' clearances.
export const FLOATING_PRIMARY_ACTION_CLEARANCE = sizes.primaryButton + layout.barBottom * 2 + 16;

// A screen's main action (a large PrimaryButton) floating above the home indicator, over the
// content, placed like the floating bars.
export default function FloatingPrimaryAction({ children }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[styles.container, { bottom: bottom + layout.barBottom }]} pointerEvents="box-none">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    zIndex: 100,
  },
});
