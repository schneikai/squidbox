import { use } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import ProgressOverlayStateContext from './ProgressOverlayStateContext';
import ProgressRing from './ProgressRing';

// The visual overlay, rendered IN-TREE (never via a native Modal). A native Modal presents from the
// ROOT view controller, which UIKit refuses while a native-stack sheet is already presented — so the
// overlay would never show over a modal. Instead we mount one host at the app root AND one inside
// each modal route (see RootNavigator.asModalRoute): whichever surface is on top renders its own
// host and covers itself. All hosts read the same context state, so a single show()/updateProgress()/
// hide() drives them together. box-only blocks touches to the content underneath (blocking + progress).
export default function ProgressOverlayHost() {
  const { mode, progress } = use(ProgressOverlayStateContext);
  if (mode === null) return null;
  return (
    <View style={styles.overlay} pointerEvents="box-only">
      {mode === 'progress' ? <ProgressRing value={progress} /> : <ActivityIndicator size="large" color="white" />}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 9999,
  },
});
