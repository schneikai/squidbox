import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, Pressable } from 'react-native';
import DoubleTap from 'react-native-double-tap';

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
          <Ionicons name="trash-outline" style={styles.deleteButtonIcon} />
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
    backgroundColor: 'crimson',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  deleteButtonIcon: {
    fontSize: 20,
    color: 'white',
  },
});
