import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SCREEN_PADDING } from '@/constants';
import { layout, sizes } from '@/styles/designTokens';

// The room a screen's content keeps free at the bottom for its pinned action (plus the home
// indicator's inset, which the screen adds).
export const PINNED_ACTION_CLEARANCE = sizes.primaryButton + layout.barBottom * 2;

// A screen's main action (a large PrimaryButton) pinned above the home indicator, over the content.
export default function PinnedAction({ children }) {
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
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
  },
});
