import { StyleSheet, View } from 'react-native';

import PostedAtPicker from './PostedAtPicker';

import Button from '@/components/Button';
import AddMediaMenu from '@/features/asset-picker/AddMediaMenu';
import { scale } from '@/styles/designTokens';

// The quiet row under a post editor card's text: the photo button (the Add media menu), the thread's
// Posted time on the first card (`isFirst`; only its clock until `isPostedAtShown`) and ⊕ Add to
// thread on the trailing side (with `onAddToThread`, the last card). `onActivate` runs on any of them, so the card they're on becomes
// the one being edited.
export default function PostCardToolbar({
  isFirst,
  exclude,
  onAddMedia,
  postedAt,
  isPostedAtShown,
  onChangePostedAt,
  onAddToThread,
  onActivate,
}) {
  function handleAddMedia(toggle) {
    onActivate();
    toggle();
  }

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
            onPress={() => handleAddMedia(toggle)}
          />
        )}
        exclude={exclude}
        onAdd={onAddMedia}
      />
      {isFirst && <PostedAtPicker timestamp={postedAt} isShown={isPostedAtShown} onChange={onChangePostedAt} />}
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
  // Bare icons, so they line up with the text and sit close like neighbouring toolbar icons.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(20),
  },
  trailing: {
    marginLeft: 'auto',
  },
});
