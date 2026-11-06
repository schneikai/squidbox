import { StyleSheet, View } from 'react-native';

import PostedAtPicker from './PostedAtPicker';

import Button from '@/components/Button';
import AddMediaMenu, { type AddMediaMenuProps } from '@/features/asset-picker/AddMediaMenu';
import { space } from '@/styles/designTokens';

type PostCardToolbarProps = {
  isFirst: boolean;
  exclude: AddMediaMenuProps['exclude'];
  onAddMedia: AddMediaMenuProps['onAdd'];
  postedAt: number | null;
  isPostedAtShown: boolean;
  onChangePostedAt: (timestamp: number | null) => void;
  onAddToThread?: () => void;
  onActivate: () => void;
};

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
}: PostCardToolbarProps) {
  function handleAddMedia(toggle: () => void) {
    onActivate();
    toggle();
  }

  function handleChangePostedAt(timestamp: number | null) {
    onActivate();
    onChangePostedAt(timestamp);
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
      {isFirst && <PostedAtPicker timestamp={postedAt} isShown={isPostedAtShown} onChange={handleChangePostedAt} />}
      {onAddToThread && (
        <Button
          icon="add-circle"
          colorPalette="accent"
          accessibilityLabel="Add to thread"
          onPress={() => {
            onActivate();
            onAddToThread();
          }}
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
    gap: space.md,
  },
  trailing: {
    marginLeft: 'auto',
  },
});
