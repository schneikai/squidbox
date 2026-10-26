import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

// A screen's main action floating above the home indicator, over the content, placed like the
// floating bars: a large PrimaryButton across the width, or with `align="center"` a pill-sized
// action (a FloatingPill) in the middle. The content keeps useFloatingPrimaryActionPadding free.
export default function FloatingPrimaryAction({ children, align = 'stretch' }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={[styles.container, align === 'center' && styles.center, { bottom: bottom + layout.barBottom }]}
      pointerEvents="box-none"
    >
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
  center: {
    alignItems: 'center',
  },
});
