import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

// A screen's main action (a large PrimaryButton) floating above the home indicator, over the
// content, placed like the floating bars. The content keeps useFloatingPrimaryActionPadding free.
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
