import { useMemo } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import handleSuggestions, { handleEntries, type HandleSuggestion } from './handleSuggestions';

import Divider from '@/components/Divider';
import RowSlots from '@/components/RowSlots';
import Text from '@/components/Text';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import keepFocusOnPress from '@/lib/keepFocusOnPress';
import { colors, layout, press, radii, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

type HandleSuggestionsProps = {
  query: string;
  assetIds: string[];
  // The handles already there (with or without the @), left out.
  taken?: readonly string[];
  onPick: (handle: string) => void;
};

/**
 * The contacts the @handle being typed may mean (`query`, without the @; handleSuggestions), those on
 * the post's photos (`assetIds`) first, none of those `taken`, each with its avatar, name, handle and networks; a tap hands
 * the handle to `onPick`. Only text: nothing is linked to the contact. Nothing shows while reading or when no contact matches.
 */
export default function HandleSuggestions({ query, assetIds, taken, onPick }: HandleSuggestionsProps) {
  const contacts = useContactRows({});
  const onPhotos = useContactRows({ scope: { photoIds: assetIds } });

  const entries = useMemo(() => contacts && handleEntries(contacts), [contacts]);
  const onPhotoIds = useMemo(() => onPhotos && new Set(onPhotos.map(({ id }) => id)), [onPhotos]);
  const takenKeys = useMemo(() => new Set(taken?.map((handle) => handle.replace(/^@/, '').toLowerCase())), [taken]);
  const suggestions = useMemo(
    () => (entries && onPhotoIds ? handleSuggestions(entries, onPhotoIds, query, takenKeys) : []),
    [entries, onPhotoIds, query, takenKeys],
  );

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.list} testID="mention-suggestions" {...keepFocusOnPress}>
      {suggestions.map((suggestion, index) => (
        <View key={suggestion.key}>
          {index > 0 && <Divider style={styles.divider} />}
          <SuggestionRow suggestion={suggestion} onPick={onPick} />
        </View>
      ))}
    </View>
  );
}

type SuggestionRowProps = { suggestion: HandleSuggestion; onPick: (handle: string) => void };

function SuggestionRow({ suggestion: { contact, handle, networks }, onPick }: SuggestionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => pressed && press.flat}
      onPress={() => onPick(handle)}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, @${handle} on ${networks.join(' and ')}`}
      accessibilityHint="Adds the handle"
    >
      <RowSlots size="small" leading={<ContactAvatar contact={contact} size="chip" />}>
        <Text variant="title" size="small" numberOfLines={1}>
          {contact.name}
        </Text>
        <RNText style={listTextStyles.subtitle} numberOfLines={1}>
          @{handle} · {networks.join(', ')}
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
