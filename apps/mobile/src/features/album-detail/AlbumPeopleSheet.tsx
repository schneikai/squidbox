import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import BottomSheet from '@/components/BottomSheet';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import Text from '@/components/Text';
import type useAlbumPeople from '@/features/album-detail/useAlbumPeople';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContacts from '@/features/contacts-context/useContacts';
import { space } from '@/styles/designTokens';
import confirmAsync from '@/utils/confirmAsync';
import pluralizeText from '@/utils/pluralizeText';

type AlbumPeopleSheetProps = {
  albumId: string;
  people: NonNullable<ReturnType<typeof useAlbumPeople>>;
  hasPhotos: boolean;
  isVisible: boolean;
  onClose: () => void;
};

/**
 * The contacts in an album (useAlbumPeople), in a bottom sheet over it: a chip per contact with how
 * many of its photos they are on, opening the contact; its × takes them off all the album's photos,
 * once confirmed. Add opens the Add contacts sheet for all its photos.
 */
export default function AlbumPeopleSheet({ albumId, people, hasPhotos, isVisible, onClose }: AlbumPeopleSheetProps) {
  const { removeContactsFromPhotosOf } = useContacts();

  function open(pathname: string, params?: Record<string, string>) {
    onClose();
    router.navigate(params ? { pathname, params } : pathname);
  }

  async function remove(contact: (typeof people)[number]) {
    const isConfirmed = await confirmAsync({
      title: `Remove ${contact.name}?`,
      message: `${contact.name} comes off ${pluralizeText('the photo', 'all %{count} photos', contact.photoCount)} in this album.`,
      action: 'Remove',
      destructive: true,
    });
    if (isConfirmed) await removeContactsFromPhotosOf({ targetType: 'album', targetId: albumId }, [contact.id]);
  }

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="Contacts">
      <View style={styles.content}>
        <Text variant="hint">On this album's photos.</Text>
        <ChipRow>
          {people.map((contact) => (
            <Chip
              key={contact.id}
              label={contact.photoCount ? `${contact.name} · ${contact.photoCount}` : contact.name}
              size="large"
              leading={<ContactAvatar contact={contact} size="chip" />}
              onPress={() => open(`/contact/${contact.id}`)}
              accessibilityHint={pluralizeText('On 1 photo', 'On %{count} photos', contact.photoCount)}
              onRemove={() => remove(contact)}
              removeLabel={`Remove ${contact.name} from this album's photos`}
            />
          ))}
          {hasPhotos && (
            <Chip
              variant="add"
              size="large"
              label="Add"
              accessibilityLabel="Add contacts to all photos"
              onPress={() => open('/add-contacts', { photosOfAlbumId: albumId })}
            />
          )}
        </ChipRow>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space.md,
  },
});
