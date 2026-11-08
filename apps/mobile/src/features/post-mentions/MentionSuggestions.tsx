import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import mentionSuggestions, { type MentionSuggestion } from './mentionSuggestions';
import useMentionContacts from './useMentionContacts';

import Divider from '@/components/Divider';
import Text from '@/components/Text';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, radii, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

type MentionSuggestionsProps = { query: string; assetIds: string[]; onPick: (handle: string) => void };

/**
 * The contacts the @handle being typed may mean (`query`, without the @; mentionSuggestions), those on
 * the post's photos (`assetIds`) first, each
 * with its avatar, name, handle and networks; a tap hands the handle to `onPick`. Only text: nothing
 * is linked to the contact. Nothing shows while reading or when no contact matches.
 */
export default function MentionSuggestions({ query, assetIds, onPick }: MentionSuggestionsProps) {
  const contacts = useMentionContacts(assetIds);

  const suggestions = contacts ? mentionSuggestions(contacts, query) : [];

  if (suggestions.length === 0) return null;

  return (
    <View style={styles.list} testID="mention-suggestions">
      {suggestions.map((suggestion, index) => (
        <View key={suggestion.key}>
          {index > 0 && <Divider style={styles.divider} />}
          <SuggestionRow suggestion={suggestion} onPick={onPick} />
        </View>
      ))}
    </View>
  );
}

type SuggestionRowProps = { suggestion: MentionSuggestion; onPick: (handle: string) => void };

function SuggestionRow({ suggestion: { contact, handle, networks }, onPick }: SuggestionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && press.flat]}
      onPress={() => onPick(handle)}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, @${handle} on ${networks.join(' and ')}`}
      accessibilityHint="Adds the handle to the text"
    >
      <ContactAvatar contact={contact} size="chip" />
      <View style={styles.labels}>
        <Text variant="title" size="small" numberOfLines={1}>
          {contact.name}
        </Text>
        <RNText style={listTextStyles.subtitle} numberOfLines={1}>
          @{handle} · {networks.join(', ')}
        </RNText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // A grey panel right under the text, so the suggestions read apart from what is written, rounded
  // like a list row's thumbnail.
  list: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radii.cover,
    backgroundColor: colors.background.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.rowLeadingGap,
    paddingVertical: space.sm,
  },
  labels: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    marginLeft: sizes.avatar.chip + layout.rowLeadingGap,
  },
});
