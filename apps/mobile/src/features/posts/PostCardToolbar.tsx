import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import PostedAtPicker, { type PostedAtPickerProps } from './PostedAtPicker';

import Button from '@/components/Button';
import AddMediaMenu, { type AddMediaMenuProps } from '@/features/asset-picker/AddMediaMenu';
import { space } from '@/styles/designTokens';

export type PostCardToolbarProps = {
  isFirst: boolean;
  exclude: AddMediaMenuProps['exclude'];
  onAddMedia: AddMediaMenuProps['onAdd'];
  postedAt: PostedAtPickerProps['timestamp'];
  isPostedAtShown: PostedAtPickerProps['isShown'];
  onChangePostedAt: PostedAtPickerProps['onChange'];
  onAddToThread?: () => void;
  onActivate: () => void;
  trailing?: ReactNode;
};

// The quiet row under a post editor card's text: the photo button (the Add media menu), the thread's
// Posted time on the first card (`isFirst`; only its clock until `isPostedAtShown`) and on the
// trailing side `trailing` (the card's text counter) and ⊕ Add
// to thread (with `onAddToThread`, the last card). `onActivate` runs on any of them, so the card they're on becomes
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
  trailing,
}: PostCardToolbarProps) {
  function handleAddMedia(toggle: () => void) {
    onActivate();
    toggle();
  }

  function handleChangePostedAt(timestamp: PostedAtPickerProps['timestamp']) {
    onActivate();
    onChangePostedAt(timestamp);
  }

  // Only the ⊕ calls it, and it shows only with `onAddToThread`.
  function handleAddToThread() {
    onActivate();
    onAddToThread?.();
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
      {(trailing || onAddToThread) && (
        <View style={styles.trailing}>
          {trailing}
          {onAddToThread && (
            <Button
              icon="add-circle"
              colorPalette="accent"
              accessibilityLabel="Add to thread"
              onPress={handleAddToThread}
            />
          )}
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
});
