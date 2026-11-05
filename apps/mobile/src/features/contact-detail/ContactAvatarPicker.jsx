import { StyleSheet, View } from 'react-native';

import Button from '@/components/Button';
import SuperPressable from '@/components/SuperPressable';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

/**
 * A contact form's photo: the contact's hero avatar (the picture at `uri` when given) over Add photo,
 * or Change photo once `hasPhoto`, which picks one square photo and hands its uri to `onPick`.
 * `onDoublePress` makes a double tap on the avatar do something (the contact screen's favorite).
 */
export default function ContactAvatarPicker({ contact, uri, hasPhoto, isFavorite, onPick, onDoublePress, style }) {
  async function handlePick() {
    const [picked] =
      (await pickImageFromMediaLibrary({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
      })) ?? [];
    if (picked) onPick(picked.uri);
  }

  const avatar = <ContactAvatar contact={contact} uri={uri} size="hero" isFavorite={isFavorite} />;

  return (
    <View style={[styles.picker, style]}>
      {onDoublePress ? (
        <SuperPressable onDoublePress={onDoublePress} accessibilityHint="Double tap to favorite">
          {avatar}
        </SuperPressable>
      ) : (
        avatar
      )}
      <Button label={hasPhoto ? 'Change photo' : 'Add photo'} size="small" onPress={handlePick} />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    alignItems: 'center',
    gap: 4,
  },
});
