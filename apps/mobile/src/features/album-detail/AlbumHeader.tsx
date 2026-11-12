import { router } from 'expo-router';
import { Pressable, Text as NativeText, StyleSheet, View } from 'react-native';

import Badge from '@/components/Badge';
import Chip from '@/components/Chip';
import Icon from '@/components/Icon';
import SuperPressable from '@/components/SuperPressable';
import Text from '@/components/Text';
import albumAssetCountText from '@/features/album-list/albumAssetCountText';
import albumLastPostedText from '@/features/album-list/albumLastPostedText';
import useAlbums from '@/features/albums-context/useAlbums';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import postQuery from '@/features/post-list/postQuery';
import { colors, layout, press, sizes, space, textStyles } from '@/styles/designTokens';
import type { AlbumRow } from '@/sync/db/schema';
import { usePagedQuery } from '@/sync/usePagedQuery';
import isSmartAlbum from '@/utils/albums/isSmartAlbum';
import pluralizeText from '@/utils/pluralizeText';

// The faces stacked on the people chip.
const STACKED = 3;

type AlbumHeaderProps = {
  album: AlbumRow;
  assetCount: number | undefined;
  /** Where the name ends, from the header's top (the name is its first line): the screen's header
   * shows the name once it has scrolled past there. */
  onNameEnd?: (y: number) => void;
};

/**
 * The top of an album, over its grid: its name, how many assets and when it was last posted (after a star
 * when it is starred), its notes, the Archived badge, then, on one line, a chip with the faces of the
 * contacts on its photos, which opens the album's Contacts sheet (AddContactsScreen), and one with its
 * posts, which pushes them, each only when it has some. A smart album has no contacts of its own, so no
 * contacts chip. The name, the line under it and the notes open Edit album; a double-tap on the name or
 * the line under it stars or unstars it.
 */
export default function AlbumHeader({ album, assetCount, onNameEnd }: AlbumHeaderProps) {
  const { toggleFavoriteAlbum } = useAlbums();
  const isSmart = isSmartAlbum(album);
  // A smart album has no contacts of its own: read once, not kept live.
  const people = useContactRows({ scope: { photosOf: { albumId: album.id } } }, { isLive: !isSmart });
  const posts = usePagedQuery(postQuery({ scope: { albumId: album.id }, sort: 'postedAt:desc' }), 1);

  // Contacts are added from the ⋯ menu (Add contacts), so none shows no chip.
  const hasPeople = !isSmart && !!people?.length;
  const faces = people?.slice(0, STACKED) ?? [];
  const names = people?.map((contact) => contact.name) ?? [];
  const lastPostedAt = posts.rows?.[0]?.postedAt ?? null;
  const details = [
    albumAssetCountText(assetCount ?? 0),
    ...(posts.rows ? [albumLastPostedText({ lastPostedAt })] : []),
  ].join(' · ');

  // The name and the note each open Edit album, the note with the cursor in it.
  function openEdit(focus?: 'notes') {
    router.navigate({ pathname: '/album/[albumId]/edit', params: { albumId: album.id, focus } });
  }

  function openContacts() {
    router.navigate({ pathname: '/add-contacts', params: { albumId: album.id } });
  }

  // The name and the line under it.
  const nameTaps = {
    onPress: () => openEdit(),
    onDoublePress: () => toggleFavoriteAlbum(album),
    accessibilityHint: 'Edit album',
  };

  return (
    <View style={styles.header}>
      <View>
        <SuperPressable
          {...nameTaps}
          style={({ pressed }) => pressed && press.flat}
          accessibilityRole="header"
          onLayout={(e) => onNameEnd?.(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >
          <NativeText style={[textStyles.title1, styles.name]} numberOfLines={2}>
            {album.name}
          </NativeText>
        </SuperPressable>
        <SuperPressable
          {...nameTaps}
          style={({ pressed }) => [styles.details, pressed && press.flat]}
          accessibilityRole="button"
          accessibilityLabel={album.isFavorite ? `Starred, ${details}` : details}
        >
          {!!album.isFavorite && <Icon name="star" filled size={sizes.iconSmall} color={colors.text.secondary} />}
          <Text variant="status">{details}</Text>
        </SuperPressable>
        {/* Closer to the details than the header's gap: the lines' own leading adds to it. */}
        {!!album.notes && (
          <View style={styles.notes}>
            <Pressable
              style={({ pressed }) => pressed && press.flat}
              onPress={() => openEdit('notes')}
              accessibilityRole="button"
              accessibilityHint="Edit album"
            >
              <Text variant="hint">{album.notes}</Text>
            </Pressable>
          </View>
        )}
      </View>
      {!!album.archivedAt && <Badge label="Archived" tone="danger" />}
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
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.iconGapSmall,
  },
  notes: {
    marginTop: space.sm,
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
