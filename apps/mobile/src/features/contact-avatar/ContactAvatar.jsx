import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import useAssetThumbnailLoader from '@/features/asset-thumbnail-loader/useAssetThumbnailLoader';
import useCloud from '@/features/cloud/useCloud';
import { isFileName } from '@/library/fileFields';
import useLibrary from '@/library/useLibrary';
import { colors, scale, sizes } from '@/styles/designTokens';
import { getAvatarUri, hasAvatarAsync } from '@/utils/assets/assetStorage';

/**
 * A contact's round avatar: the picture at `uri` when given, else the contact's photo (from the device,
 * or fetched from the user's storage), else its initials (a person without a
 * name yet) on the accent's soft surface, like the account button.
 * `size` is `chip`, `small`, `regular`, `large` or `hero` (sizes.avatar). With `isFavorite` it wears a red heart on a white
 * disc at its bottom right; `isStacked` rings it in white, for avatars overlapping in a stack.
 * VoiceOver reads the contact's name. style is for layout only.
 */
export default function ContactAvatar({
  contact,
  uri,
  size = 'regular',
  isFavorite = false,
  isStacked = false,
  style,
}) {
  const avatarUri = useAvatarUri(contact);
  const diameter = sizes.avatar[size];
  const initials = initialsOf(contact.name);
  const heart = Math.max(scale(14), Math.round(diameter * 0.32));
  const pictureUri = uri ?? avatarUri;

  return (
    <View
      style={[
        styles.avatar,
        { width: diameter, height: diameter, borderRadius: diameter / 2 },
        isStacked && styles.stacked,
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={contact.name || 'New contact'}
    >
      {pictureUri ? (
        <Image source={{ uri: pictureUri }} style={[StyleSheet.absoluteFill, { borderRadius: diameter / 2 }]} />
      ) : initials ? (
        <Text style={[styles.initials, { fontSize: Math.round(diameter * 0.38) }]} numberOfLines={1}>
          {initials}
        </Text>
      ) : (
        <Icon name="user" size={Math.round(diameter * 0.45)} color={colors.accent.base} />
      )}
      {isFavorite && (
        <View style={[styles.heart, { width: heart, height: heart, borderRadius: heart / 2 }]}>
          <Icon name="heart" size={Math.round(heart * 0.62)} color={colors.status.danger} filled />
        </View>
      )}
    </View>
  );
}

// The photos found on this device since launch, by uri: an avatar shown again (a row scrolled back,
// the same contact in a row and a stack) skips the file check.
const foundUris = new Set();
const MAX_FOUND_URIS = 2000;

function rememberFound(uri) {
  if (foundUris.size >= MAX_FOUND_URIS) foundUris.delete(foundUris.values().next().value);
  foundUris.add(uri);
}

// The uri of the contact's photo once it is on the device: one not on it yet is fetched
// through the loader while signed in; null until then, and for a contact without a photo (or with a
// name that isn't a file name, isFileName).
function useAvatarUri(contact) {
  const filename = contact.avatarFilename && isFileName(contact.avatarFilename) ? contact.avatarFilename : null;
  const [shown, setShown] = useState(null); // the filename found on the device
  const { paths: library } = useLibrary();
  const { isAuthenticated } = useCloud();
  const { loadAvatar } = useAssetThumbnailLoader();
  const uri = filename ? getAvatarUri(filename, library) : null;
  const isShown = !!uri && (shown === filename || foundUris.has(uri));

  useEffect(() => {
    if (!filename || isShown) return undefined;
    let isCancelled = false;
    let withdraw;
    function showFound() {
      rememberFound(getAvatarUri(filename, library));
      setShown(filename);
    }
    (async () => {
      const isLocal = await hasAvatarAsync(filename, library);
      if (isCancelled) return;
      if (isLocal) showFound();
      else if (isAuthenticated) {
        withdraw = loadAvatar({ avatarFilename: filename }, (result) => result === 'done' && showFound());
      }
    })();
    return () => {
      isCancelled = true;
      withdraw?.();
    };
  }, [filename, isAuthenticated, isShown, library, loadAvatar]);

  return isShown ? uri : null;
}

// The first letters of the name's first two words ("Maya Lindqvist" → "ML").
function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => [...word][0].toUpperCase())
    .join('');
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.accent.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stacked: {
    borderWidth: 2,
    borderColor: colors.background.surface,
  },
  initials: {
    color: colors.accent.base,
    fontWeight: '600',
  },
  heart: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
