import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import { layout } from '@/styles/designTokens';

/**
 * The Deleted album's bottom toolbar: Restore on the left, Delete permanently on the right, each in
 * words since they act on many photos at once: every deleted one, or the selection (`isSelectMode`).
 */
export default function DeletedAlbumActionsBar({ isSelectMode, isDisabled, onRestore, onDelete }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.row, { bottom: insets.bottom + layout.barBottom }]} pointerEvents="box-none">
      <FloatingPill>
        <Button label={isSelectMode ? 'Restore' : 'Restore all'} onPress={onRestore} disabled={isDisabled} />
      </FloatingPill>
      <FloatingPill>
        <Button
          label={isSelectMode ? 'Delete' : 'Delete all'}
          colorPalette="danger"
          onPress={onDelete}
          disabled={isDisabled}
          accessibilityLabel={isSelectMode ? 'Delete selected permanently' : 'Delete all permanently'}
        />
      </FloatingPill>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: layout.sideGutter,
    right: layout.sideGutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
});
