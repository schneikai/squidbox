import { StyleSheet, View, Pressable } from 'react-native';
import DoubleTap from 'react-native-double-tap';

import Icon from '@/components/Icon';
import { colors, spacing, radii } from '@/styles/designTokens';

export default function AlbumListItemWithEditMode({
  children,
  isEditMode,
  isEditable,
  singleTap,
  doubleTap,
  onPressDelete,
}) {
  if (isEditMode && !isEditable) return children;

  if (isEditMode) {
    return (
      <View>
        <Pressable onPress={onPressDelete} style={styles.deleteButton}>
          <Icon name="trash" color={colors.textInverse} />
        </Pressable>
        {children}
      </View>
    );
  }

  return (
    <DoubleTap singleTap={singleTap} doubleTap={doubleTap} delay={200}>
      {children}
    </DoubleTap>
  );
}

const styles = StyleSheet.create({
  deleteButton: {
    position: 'absolute',
    right: 5,
    backgroundColor: colors.danger,
    borderRadius: radii.pill,
    width: spacing.iconButtonSize,
    height: spacing.iconButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
