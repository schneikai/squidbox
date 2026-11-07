import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text as NativeText, StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import Text from '@/components/Text';
import AlbumPeopleSheet from '@/features/album-detail/AlbumPeopleSheet';
import useAlbumPeople from '@/features/album-detail/useAlbumPeople';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
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
 * Archived badge and its notes, then a chip with the faces of the contacts in it (useAlbumPeople),
 * which opens them in a bottom sheet, and one with its posts, which pushes them. A smart album has no
 * contacts of its own, so no contacts chip.
 */
export default function AlbumHeader({ album, assetCount }: AlbumHeaderProps) {
  const people = useAlbumPeople(album.id);
  const posts = usePagedQuery(postQuery({ scope: { albumId: album.id }, sort: 'postedAt:desc' }), 1);
  const [isPeopleShown, setIsPeopleShown] = useState(false);

  const isSmart = isSmartAlbum(album);
  const hasPhotos = !!assetCount;
  const lastPostedAt = posts.rows?.[0]?.postedAt ?? null;
  const details = [
    pluralizeText('1 Asset', '%{count} Assets', assetCount ?? 0),
    ...(posts.rows ? [albumLastPostedText({ lastPostedAt })] : []),
  ].join(' · ');

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
      <View style={styles.chips}>
        <ChipRow>
          {!isSmart &&
            !!people &&
            (people.length ? (
              <Chip
                label={peopleNames(people.map((contact) => contact.name))}
                size="large"
                leading={
                  <View style={styles.faces}>
                    {people.slice(0, STACKED).map((contact, i) => (
                      <ContactAvatar
                        key={contact.id}
                        contact={contact}
                        size="chip"
                        isStacked
                        style={i > 0 && styles.overlapped}
                      />
                    ))}
                  </View>
                }
                accessibilityLabel={`Contacts: ${people.map((contact) => contact.name).join(', ')}`}
                onPress={() => setIsPeopleShown(true)}
              />
            ) : (
              hasPhotos && (
                <Chip
                  variant="add"
                  size="large"
                  label="Add contacts"
                  onPress={() => router.navigate({ pathname: '/add-contacts', params: { photosOfAlbumId: album.id } })}
                />
              )
            ))}
          {!!posts.count && (
            <Chip
              label={pluralizeText('1 post', '%{count} posts', posts.count)}
              icon="share-alt"
              size="large"
              onPress={() => router.navigate(`/album/${album.id}/posts`)}
            />
          )}
        </ChipRow>
      </View>
      {!!people && (
        <AlbumPeopleSheet
          albumId={album.id}
          people={people}
          hasPhotos={hasPhotos}
          isVisible={isPeopleShown}
          onClose={() => setIsPeopleShown(false)}
        />
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
  chips: {
    alignSelf: 'stretch',
  },
  faces: {
    flexDirection: 'row',
  },
  overlapped: {
    marginLeft: -space.sm,
  },
});
