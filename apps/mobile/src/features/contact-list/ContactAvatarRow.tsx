import { router } from 'expo-router';
import { FlatList, type ListRenderItemInfo, Pressable, StyleSheet, Text } from 'react-native';

import type { ContactSummary } from './contactQuery';

import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, sizes, space, textStyles } from '@/styles/designTokens';

/**
 * The pinned row on Contacts (Favorites, or the list pinned in their place): each contact's avatar
 * (no heart) with its first name, side by side, opening the contact. `contacts` are the loaded ones
 * of a paged query; `loadMore` reads the next page as the row nears its end, as the lists do.
 */
type ContactAvatarRowProps = { contacts: ContactSummary[]; loadMore: () => void };

const keyExtractor = (contact: ContactSummary) => contact.id;

export default function ContactAvatarRow({ contacts, loadMore }: ContactAvatarRowProps) {
  return (
    <FlatList
      horizontal
      data={contacts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={loadMore}
      onEndReachedThreshold={2}
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={styles.row}
    />
  );
}

function renderItem({ item: contact }: ListRenderItemInfo<ContactSummary>) {
  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && press.flat]}
      onPress={() => router.navigate(`/contact/${contact.id}`)}
      accessibilityRole="button"
      accessibilityLabel={contact.name}
    >
      <ContactAvatar contact={contact} size="medium" />
      <Text style={[textStyles.footnote, styles.name]} numberOfLines={1}>
        {contact.name.trim().split(/\s+/)[0]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Reaches the screen's edges, so it scrolls edge to edge, with the first avatar on the list's edge,
  // as on Albums (StarredAlbumRow).
  scroller: {
    marginHorizontal: -layout.sideGutter,
  },
  row: {
    gap: space.xl,
    paddingHorizontal: layout.sideGutter,
  },
  item: {
    width: sizes.avatar.medium,
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    color: colors.text.primary,
  },
});
