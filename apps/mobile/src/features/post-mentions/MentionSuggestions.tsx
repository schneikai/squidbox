import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import mentionSuggestions, { type MentionSuggestion } from './mentionSuggestions';
import useMentionContacts from './useMentionContacts';

import Divider from '@/components/Divider';
import Text from '@/components/Text';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { layout, press, sizes, space } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';

type MentionSuggestionsProps = { query: string; onPick: (handle: string) => void };

/**
 * The contacts the @handle being typed may mean (`query`, without the @; mentionSuggestions), each
 * with its avatar, name, handle and networks; a tap hands the handle to `onPick`. Only text: nothing
 * is linked to the contact. Nothing shows while reading or when no contact matches.
 */
export default function MentionSuggestions({ query, onPick }: MentionSuggestionsProps) {
  const contacts = useMentionContacts();

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
  // Under the text at the card's gap, the rows starting where the text does.
  list: {
    marginTop: layout.cardGap - space.sm,
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
