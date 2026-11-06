import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layout } from '@/styles/designTokens';

export type FloatingPrimaryActionProps = { children?: ReactNode; align?: 'stretch' | 'center' };

// A screen's main action floating above the home indicator, over the content, placed like the
// floating bars: a primary Button across the width, a row of toolbars across it (the Deleted
// album's Restore and Delete), or with `align="center"` a pill-sized action (a FloatingPill) in the
// middle. The content keeps useFloatingPrimaryActionPadding free.
export default function FloatingPrimaryAction({ children, align = 'stretch' }: FloatingPrimaryActionProps) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={[styles.container, align === 'center' && styles.center, { bottom: bottom + layout.barMargin }]}
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
