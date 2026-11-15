import { useMemo } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import type { MentionContact } from './mentionHandle';
import mentionSuggestions, { mentionEntries, type MentionSuggestion } from './mentionSuggestions';

import Divider from '@/components/Divider';
import RowSlots from '@/components/RowSlots';
import Text from '@/components/Text';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import keepFocusOnPress from '@/lib/keepFocusOnPress';
import { colors, layout, press, radii, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

type MentionSuggestionsProps = {
  query: string;
  contactsById: ReadonlyMap<string, MentionContact>;
  assetIds: string[];
  onPick: (contact: MentionContact) => void;
};

/**
 * The contacts (`contactsById`) the @ being typed may mean (`query`, without the @;
 * mentionSuggestions), those on the post's photos (`assetIds`) first, each with its avatar, name and
 * handles; a tap hands the contact to `onPick`. Nothing shows while reading or when no contact matches.
 */
export default function MentionSuggestions({ query, contactsById, assetIds, onPick }: MentionSuggestionsProps) {
  const onPhotos = useContactRows({ scope: { photoIds: assetIds } });

  const entries = useMemo(() => mentionEntries([...contactsById.values()]), [contactsById]);
  const onPhotoIds = useMemo(() => onPhotos && new Set(onPhotos.map(({ id }) => id)), [onPhotos]);
  const suggestions = useMemo(
    () => (onPhotoIds ? mentionSuggestions(entries, onPhotoIds, query) : []),
    [entries, onPhotoIds, query],
  );

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.list} testID="mention-suggestions" {...keepFocusOnPress}>
      {suggestions.map((suggestion, index) => (
        <View key={suggestion.contact.id}>
          {index > 0 && <Divider style={styles.divider} />}
          <SuggestionRow suggestion={suggestion} onPick={onPick} />
        </View>
      ))}
    </View>
  );
}

type SuggestionRowProps = { suggestion: MentionSuggestion; onPick: (contact: MentionContact) => void };

function SuggestionRow({ suggestion: { contact, handlesText }, onPick }: SuggestionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => pressed && press.flat}
      onPress={() => onPick(contact)}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${handlesText}`}
      accessibilityHint="Mentions the contact"
    >
      <RowSlots size="small" leading={<ContactAvatar contact={contact} size="chip" />}>
        <Text variant="title" size="small" numberOfLines={1}>
          {contact.name}
        </Text>
        <RNText style={listTextStyles.subtitle} numberOfLines={1}>
          {handlesText}
        </RNText>
      </RowSlots>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A grey panel right under the text, so the suggestions read apart from what is written, rounded
  // like a list row's thumbnail.
  list: {
    marginTop: space.sm,
    borderRadius: radii.cover,
    backgroundColor: colors.background.muted,
  },
  divider: {
    marginLeft: layout.rowInset + sizes.avatar.chip + layout.rowLeadingGap,
  },
});
