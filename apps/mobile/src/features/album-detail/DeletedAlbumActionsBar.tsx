import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import FloatingPill from '@/components/floating-bars/FloatingPill';
import FloatingPrimaryAction from '@/components/floating-bars/FloatingPrimaryAction';

type DeletedAlbumActionsBarProps = {
  isSelectMode: boolean;
  isDisabled: boolean;
  onRestore: () => void;
  onDelete: () => void;
};

/**
 * The Deleted album's bottom toolbar: Restore on the left, Delete permanently on the right, each in
 * words since they act on many photos at once: every deleted one, or the selection (`isSelectMode`).
 */
export default function DeletedAlbumActionsBar({
  isSelectMode,
  isDisabled,
  onRestore,
  onDelete,
}: DeletedAlbumActionsBarProps) {
  const suffix = isSelectMode ? '' : ' all';

  return (
    <FloatingPrimaryAction>
      <View style={styles.row} pointerEvents="box-none">
        <FloatingPill>
          <Button label={`Restore${suffix}`} onPress={onRestore} disabled={isDisabled} />
        </FloatingPill>
        <FloatingPill>
          <Button
            label={`Delete${suffix}`}
            colorPalette="danger"
            onPress={onDelete}
            disabled={isDisabled}
            accessibilityLabel={`Delete${suffix} permanently`}
          />
        </FloatingPill>
      </View>
    </FloatingPrimaryAction>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
