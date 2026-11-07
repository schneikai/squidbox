import { router } from 'expo-router';
import { Pressable, Text as NativeText, StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import Chip from '@/components/Chip';
import Text from '@/components/Text';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useTargetContacts from '@/features/contact-links/useTargetContacts';
import postQuery from '@/features/post-list/postQuery';
import { colors, press, space, textStyles } from '@/styles/designTokens';
import type { AlbumRow } from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import pluralizeText from '@/utils/pluralizeText';

// The faces stacked on the people chip.
const STACKED = 3;

type AlbumHeaderProps = {
  album: AlbumRow;
  assetCount: number | undefined;
};

/**
 * The top of an album, over its grid: its name, how many assets and when it was last posted, the
 * Archived badge and its notes, then, on one line, a chip with the faces of the contacts on its
 * photos or on the album (useTargetContacts), which opens the album's Contacts sheet (AddContactsScreen), and one
 * with its posts, which pushes them, each only when it has some. A smart album has no contacts of its own, so no contacts chip.
 */
export default function AlbumHeader({ album, assetCount }: AlbumHeaderProps) {
  const isSmart = isSmartAlbum(album);
  // A smart album has no contacts of its own: read once, not kept live.
  const people = useTargetContacts('album', album.id, { isLive: !isSmart })?.contacts;
  const posts = usePagedQuery(postQuery({ scope: { albumId: album.id }, sort: 'postedAt:desc' }), 1);

  // Contacts are added from the ⋯ menu (Add contacts to photos), so none shows no chip.
  const hasPeople = !isSmart && !!people?.length;
  const faces = people?.slice(0, STACKED) ?? [];
  const names = people?.map((contact) => contact.name) ?? [];
  const lastPostedAt = posts.rows?.[0]?.postedAt ?? null;
  const details = [
    pluralizeText('1 Asset', '%{count} Assets', assetCount ?? 0),
    ...(posts.rows ? [albumLastPostedText({ lastPostedAt })] : []),
  ].join(' · ');

  function openContacts() {
    router.navigate({ pathname: '/add-contacts', params: { photosOfAlbumId: album.id } });
  }

  return (
    <View style={styles.header}>
      <View>
        <NativeText style={[textStyles.title1, styles.name]} accessibilityRole="header" numberOfLines={2}>
          {album.name}
        </NativeText>
        <Text variant="status">{details}</Text>
      </View>
      {!!album.archivedAt && <Badge label="Archived" tone="danger" />}
      {!!album.notes && (
        <Pressable
          style={({ pressed }) => pressed && press.flat}
          onPress={() => router.navigate(`/album/${album.id}/notes`)}
        >
          <Text variant="hint">{album.notes}</Text>
        </Pressable>
      )}
      {(hasPeople || !!posts.count) && (
        <View style={styles.chips}>
          {hasPeople && (
            <View style={styles.people}>
              <Chip
                label={peopleNames(names)}
                leading={
                  <View style={styles.faces}>
                    {faces.map((contact, i) => (
                      <ContactAvatar
                        key={contact.id}
                        contact={contact}
                        size="chip"
                        cutout={i < faces.length - 1 ? space.md : undefined}
                        style={i > 0 && styles.overlapped}
                      />
                    ))}
                  </View>
                }
                accessibilityLabel={`Contacts: ${names.join(', ')}`}
                onPress={openContacts}
              />
            </View>
          )}
          {!!posts.count && (
            <Chip
              label={pluralizeText('1 post', '%{count} posts', posts.count)}
              onPress={() => router.navigate(`/album/${album.id}/posts`)}
            />
          )}
        </View>
      )}
    </View>
  );
}

// "Sam", "Sam, Theo" or "Sam, Theo and 2 more": first names, as a chip has room for.
function peopleNames(names: string[]): string {
  const first = names.map((name) => name.split(' ')[0] || name);
  if (first.length <= 2) return first.join(', ');
  return `${first.slice(0, 2).join(', ')} and ${first.length - 2} more`;
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    gap: space.md,
  },
  name: {
    color: colors.text.primary,
  },
  // One line: the contacts' names are cut short before the posts chip is.
  chips: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.sm,
  },
  people: {
    flexShrink: 1,
  },
  faces: {
    flexDirection: 'row',
  },
  overlapped: {
    marginLeft: -space.md,
  },
});
