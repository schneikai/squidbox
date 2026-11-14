import { CONTACT_HANDLES, type ContactHandleField } from '@squidbox/shared';
import { useNavigation } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { EnrichedTextInput, type EnrichedTextInputInstance } from 'react-native-enriched-html';

import Card from '@/components/Card';
import Chip from '@/components/Chip';
import ChipRow from '@/components/ChipRow';
import DetailScrollView from '@/components/DetailScrollView';
import Divider from '@/components/Divider';
import Page from '@/components/Page';
import RowSlots from '@/components/RowSlots';
import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import Text from '@/components/Text';
import FloatingDetailHeader from '@/components/floating-bars/FloatingDetailHeader';
import { Row, Section, SectionFooter } from '@/components/settings-list/SettingsList';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import { colors, press, radii, scale, space, textStyles } from '@/styles/designTokens';

const MAX_SUGGESTIONS = 4;
// <mention ... id="…" ...>@Name</mention>, as the editor writes a mention into its HTML.
const MENTION = /<mention\b([^>]*)>(.*?)<\/mention>/g;
const ID = /\bid="([^"]*)"/;
// The channels the spike shows what goes out on, each with the contact handle it uses.
const CHANNELS: { name: string; field: ContactHandleField }[] = [
  { name: 'X', field: 'xHandle' },
  { name: 'Bluesky', field: 'blueskyHandle' },
  { name: 'Instagram', field: 'instagramHandle' },
  { name: 'OnlyFans', field: 'onlyFansHandle' },
];

/**
 * SPIKE (Settings → Developer): a post text field built on react-native-enriched-html, to try on a
 * device how mentions linked to contacts feel. Typing @ lists the contacts by name; picking one
 * writes a mention that carries the contact's id, is tinted, and is deleted as one unit. Under the
 * field: the mentioned contacts as chips, the text as each channel would get it (the contact's
 * handle there, or the name without one), and the HTML the editor holds.
 */
export default function MentionSpikeScreen() {
  const navigation = useNavigation();
  const inputRef = useRef<EnrichedTextInputInstance>(null);
  const contacts = useContactRows({});
  const [query, setQuery] = useState<string | null>(null);
  const [html, setHtml] = useState('');

  const suggestions = useMemo(() => {
    if (query == null || !contacts) return [];
    const needle = query.toLowerCase();
    return contacts.filter((contact) => contact.name.toLowerCase().includes(needle)).slice(0, MAX_SUGGESTIONS);
  }, [contacts, query]);
  const mentionedIds = useMemo(
    () => [...new Set([...html.matchAll(MENTION)].map((match) => ID.exec(match[1] ?? '')?.[1]))],
    [html],
  );
  const mentioned = (contacts ?? []).filter((contact) => mentionedIds.includes(contact.id));

  function textFor(field: ContactHandleField) {
    const withHandles = html.replace(MENTION, (_, attributes: string, shown: string) => {
      const contact = contacts?.find(({ id }) => id === ID.exec(attributes)?.[1]);
      const handle = contact?.[field];
      return handle ? `@${handle}` : (contact?.name ?? shown);
    });
    return plainText(withHandles);
  }

  return (
    <Page testID="mention-spike">
      <FloatingDetailHeader title="Mention editor" onBack={() => navigation.goBack()} />
      <DetailScrollView keyboardShouldPersistTaps="handled">
        <Card padded>
          <EnrichedTextInput
            ref={inputRef}
            placeholder="What's new?"
            placeholderTextColor={colors.text.tertiary}
            mentionIndicators={['@']}
            style={styles.input}
            htmlStyle={{ mention: { color: colors.text.primary, backgroundColor: colors.background.muted } }}
            onStartMention={() => setQuery('')}
            onChangeMention={({ text }) => setQuery(text)}
            onEndMention={() => setQuery(null)}
            onChangeHtml={(event) => setHtml(event.nativeEvent.value)}
          />
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((contact, index) => (
                <View key={contact.id}>
                  {index > 0 && <Divider />}
                  <Pressable
                    style={({ pressed }) => pressed && press.flat}
                    accessibilityRole="button"
                    onPress={() => inputRef.current?.setMention('@', `@${contact.name}`, { id: contact.id })}
                  >
                    <RowSlots size="small" leading={<ContactAvatar contact={contact} size="chip" />}>
                      <Text variant="title" size="small" numberOfLines={1}>
                        {contact.name}
                      </Text>
                      <Text variant="hint" numberOfLines={1}>
                        {handlesText(contact) || 'No handles'}
                      </Text>
                    </RowSlots>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {mentioned.length > 0 && (
            <View style={styles.chips}>
              <ChipRow>
                {mentioned.map((contact) => (
                  <Chip
                    key={contact.id}
                    label={contact.name}
                    leading={<ContactAvatar contact={contact} size="chip" />}
                  />
                ))}
              </ChipRow>
            </View>
          )}
        </Card>
        <SectionFooter>Type @ and a name. A mention is one unit: delete into it and it goes whole.</SectionFooter>

        <ScreenSectionHeader title="What goes out" />
        <Section>
          {CHANNELS.map(({ name, field }) => (
            <Row key={field} label={name} description={textFor(field) || 'Nothing yet'} />
          ))}
        </Section>

        <ScreenSectionHeader title="What the editor holds" />
        <Card padded>
          <Text variant="hint" selectable>
            {html || 'Nothing yet'}
          </Text>
        </Card>
      </DetailScrollView>
    </Page>
  );
}

/** A contact's handles in one line: "@sam on X · @sam.bsky.social on Bluesky". */
function handlesText(contact: Partial<Record<ContactHandleField, string | null>>) {
  return CONTACT_HANDLES.filter(({ field }) => contact[field])
    .map(({ field, label }) => `@${contact[field]} on ${label}`)
    .join(' · ');
}

/** The editor's HTML as plain text: paragraphs and breaks as new lines, tags dropped, entities read. */
function plainText(html: string) {
  return html
    .replace(/<\/p>\s*<p>|<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

const styles = StyleSheet.create({
  input: {
    minHeight: scale(84),
    fontSize: textStyles.reading.fontSize,
    color: colors.text.primary,
  },
  suggestions: {
    marginTop: space.sm,
    borderRadius: radii.cover,
    backgroundColor: colors.background.muted,
  },
  chips: {
    marginTop: space.md,
  },
});
