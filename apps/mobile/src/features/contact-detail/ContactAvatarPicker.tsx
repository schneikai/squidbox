import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import Button from '@/components/Button';
import Icon from '@/components/Icon';
import SuperPressable from '@/components/SuperPressable';
import ContactAvatar, { type ContactAvatarProps } from '@/features/contact-avatar/ContactAvatar';
import { colors, press, scale, shadows, sizes } from '@/styles/designTokens';
import pickImageFromMediaLibrary from '@/utils/media-library/pickImageFromMediaLibrary';

const CAMERA_DISC = scale(38);
const PLACEHOLDER = sizes.avatar.hero; // as big as the photo it stands for, and the contact screen's

/**
 * A contact's photo, to pick one square photo and hand its uri to `onPick`. `variant` is where it is:
 *   contact — the contact screen's hero avatar, raised off the page, with a white camera disc on
 *             its corner that picks; `onDoublePress` makes a double tap on it do something (the favorite)
 *   form    — New contact's: a camera on a disc until there is a name or a photo (the picture at
 *             `uri`), then the avatar, with Add photo (or Change photo once `hasPhoto`) under it
 */
type ContactAvatarPickerProps = {
  contact: ContactAvatarProps['contact'];
  uri?: string | null;
  hasPhoto: boolean;
  variant?: 'contact' | 'form';
  onPick: (uri: string) => void;
  onDoublePress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function ContactAvatarPicker({
  contact,
  uri,
  hasPhoto,
  variant = 'contact',
  onPick,
  onDoublePress,
  style,
}: ContactAvatarPickerProps) {
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

  if (variant === 'form') {
    const isBlank = !uri && !contact.name.trim();
    return (
      <View style={[styles.form, style]}>
        {isBlank ? (
          <Pressable
            onPress={handlePick}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            style={({ pressed }) => [styles.placeholder, pressed && press.filled]}
          >
            <Icon name="camera" size={scale(40)} color={colors.accent.base} />
          </Pressable>
        ) : (
          <ContactAvatar contact={contact} uri={uri} size="hero" />
        )}
        <Button label={hasPhoto ? 'Change photo' : 'Add photo'} onPress={handlePick} style={styles.link} />
      </View>
    );
  }

  const avatar = <ContactAvatar contact={contact} uri={uri} size="hero" />;

  return (
    <View style={[styles.hero, style]}>
      <View style={styles.raised}>
        {onDoublePress ? (
          <SuperPressable onDoublePress={onDoublePress} accessibilityHint="Double tap to favorite">
            {avatar}
          </SuperPressable>
        ) : (
          avatar
        )}
      </View>
      <Pressable
        onPress={handlePick}
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? 'Change photo' : 'Add photo'}
        hitSlop={(sizes.iconButton - CAMERA_DISC) / 2}
        style={({ pressed }) => [styles.camera, pressed && press.filled]}
      >
        <Icon name="camera" size={scale(19)} color={colors.accent.base} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    alignItems: 'center',
  },
  // Its own padding leaves the touch room; it sits close under the photo.
  link: {
    marginTop: -6,
  },
  placeholder: {
    width: PLACEHOLDER,
    height: PLACEHOLDER,
    borderRadius: PLACEHOLDER / 2,
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignSelf: 'center',
  },
  raised: {
    borderRadius: sizes.avatar.hero / 2,
    ...shadows.avatar,
  },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: CAMERA_DISC,
    height: CAMERA_DISC,
    borderRadius: CAMERA_DISC / 2,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.floating,
  },
});
