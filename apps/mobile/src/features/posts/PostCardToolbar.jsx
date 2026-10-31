import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import DateTimePicker from '@/components/DateTimePicker';
import AddMediaMenu from '@/features/asset-picker/AddMediaMenu';

// The quiet row under a post editor card's text: the photo button (the Add media menu), the thread's
// time (`postedAt`, on the first card only: with `onChangePostedAt`) and ⊕ Add to thread on the
// trailing side (the last card only: with `onAddToThread`). `onActivate` runs on any of them, so the
// card they're on becomes the one being edited.
export default function PostCardToolbar({
  exclude,
  onAddMedia,
  postedAt,
  onChangePostedAt,
  onAddToThread,
  onActivate,
}) {
  function handleAddToThread() {
    onActivate();
    onAddToThread();
  }

  return (
    <View style={styles.row}>
      <AddMediaMenu
        trigger={({ toggle }) => (
          <Button
            icon="image"
            colorPalette="accent"
            accessibilityLabel="Add photos"
            onPress={() => {
              onActivate();
              toggle();
            }}
          />
        )}
        exclude={exclude}
        onAdd={onAddMedia}
      />
      {onChangePostedAt && <DateTimePicker timestamp={postedAt} onChange={onChangePostedAt} />}
      {onAddToThread && (
        <Button
          icon="add-circle"
          colorPalette="accent"
          accessibilityLabel="Add to thread"
          onPress={handleAddToThread}
          style={styles.trailing}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The buttons' 44 pt targets reach into the card's padding, so their icons line up with the text.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: -10,
  },
  trailing: {
    marginLeft: 'auto',
  },
});
