import { use } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import ProgressOverlayStateContext from './ProgressOverlayStateContext';

import Button from '@/components/Button';
import ProgressRing from '@/components/ProgressRing';
import Text from '@/components/Text';
import { colors, space } from '@/styles/designTokens';

// The visual overlay, rendered IN-TREE (never via a native Modal). A native Modal presents from the
// ROOT view controller, which UIKit refuses while a native-stack sheet is already presented — so the
// overlay would never show over a modal. Instead we mount one host at the app root AND one inside
// each sheet (SheetRoute): whichever surface is on top renders its own
// host and covers itself. All hosts read the same context state, so a single show()/updateProgress()/
// hide() drives them together. Covering its surface, the overlay keeps touches from the content
// underneath; only its own Cancel button, when the action can be cancelled, takes them. A `note`
// (a download's Keep Squidbox open) sits quietly under it.
export default function ProgressOverlayHost() {
  const { mode, progress, cancel, note } = use(ProgressOverlayStateContext);
  if (mode === null) return null;
  return (
    <View style={styles.overlay}>
      {mode === 'progress' ? (
        <ProgressRing value={progress} />
      ) : (
        <ActivityIndicator size="large" color={colors.text.inverse} />
      )}
      {cancel && (
        <View style={styles.cancel}>
          <Button label="Cancel" onPress={cancel} isInverse colorPalette="neutral" />
        </View>
      )}
      {note && (
        <Text variant="hint" tone="inverseSecondary" style={styles.note}>
          {note}
        </Text>
      )}
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
    backgroundColor: colors.overlay.scrim,
    zIndex: 9999,
  },
  cancel: {
    marginTop: space.xxxl,
  },
  note: {
    marginTop: space.lg,
    paddingHorizontal: space.xxxl,
    textAlign: 'center',
  },
});
