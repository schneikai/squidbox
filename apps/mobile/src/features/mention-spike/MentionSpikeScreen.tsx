import { CONTACT_HANDLES, type ContactHandleField } from '@squidbox/shared';
import { useNavigation, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import MentionContactSheet from './MentionContactSheet';
import MentionInput, { type MentionInputContent, type MentionInputHandle } from './MentionInput';

import Card from '@/components/Card';
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
import useOpenLibrary from '@/library/useOpenLibrary';
import { colors, press, radii, space } from '@/styles/designTokens';
import { getAvatarUri } from '@/utils/assets/assetStorage';

const MAX_SUGGESTIONS = 4;
// The character a chip is in the field's text.
const CHIP = '\uFFFC';
// The channels the spike shows what goes out on, each with the contact handle it uses.
const CHANNELS: { name: string; field: ContactHandleField }[] = [
  { name: 'X', field: 'xHandle' },
  { name: 'Bluesky', field: 'blueskyHandle' },
  { name: 'Instagram', field: 'instagramHandle' },
  { name: 'OnlyFans', field: 'onlyFansHandle' },
];

/**
 * SPIKE (Settings → Developer): our own native text field (MentionInput, iOS) to try on a device how
 * mentions as chips inside the text feel. Typing @ lists the contacts by name; picking one puts the
 * contact's chip into the text. Under the field: the text as each channel would get it (the contact's
 * handle there, or the name without one), and what the field holds.
 */
export default function MentionSpikeScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const inputRef = useRef<MentionInputHandle>(null);
  const contacts = useContactRows({});
  const { paths: library } = useOpenLibrary();
  const [query, setQuery] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [content, setContent] = useState<MentionInputContent>({ text: '', mentions: [] });

  const pressedContact = contacts?.find((contact) => contact.id === pressedId) ?? null;
  const suggestions = useMemo(() => {
    if (query == null || !contacts) return [];
    const needle = query.toLowerCase();
    return contacts.filter((contact) => contact.name.toLowerCase().includes(needle)).slice(0, MAX_SUGGESTIONS);
  }, [contacts, query]);

  function pick(contact: NonNullable<typeof contacts>[number]) {
    const uri = contact.avatarFilename ? getAvatarUri(contact.avatarFilename, library) : null;
    inputRef.current?.insertMention(contact.id, contact.name, uri).catch(console.error);
  }

  function openContact(id: string) {
    setPressedId(null);
    router.navigate(`/contact/${id}`);
  }

  // The text with each chip written as the contact's handle on the channel, or the name without one.
  function textFor(field: ContactHandleField) {
    const byLocation = new Map(content.mentions.map((mention) => [mention.location, mention]));
    return [...content.text]
      .map((character, index) => {
        const mention = character === CHIP ? byLocation.get(index) : undefined;
        if (!mention) return character;
        const handle = contacts?.find(({ id }) => id === mention.id)?.[field];
        return handle ? `@${handle}` : mention.label;
      })
      .join('')
      .trim();
  }

  return (
    <Page testID="mention-spike">
      <FloatingDetailHeader title="Mention editor" onBack={() => navigation.goBack()} />
      <DetailScrollView keyboardShouldPersistTaps="handled">
        {Platform.OS === 'ios' ? (
          <Card padded>
            <MentionInput
              ref={inputRef}
              placeholder="What's new?"
              onChangeContent={setContent}
              onMentionQuery={setQuery}
              onMentionPress={setPressedId}
            />
            {suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {suggestions.map((contact, index) => (
                  <View key={contact.id}>
                    {index > 0 && <Divider />}
                    <Pressable
                      style={({ pressed }) => pressed && press.flat}
                      accessibilityRole="button"
                      onPress={() => pick(contact)}
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
          </Card>
        ) : (
          <Card padded>
            <Text variant="hint">The mention field is native iOS code: try it in the dev client.</Text>
          </Card>
        )}
        <SectionFooter>Type @ and a name, pick a contact. Tap a chip to see whose it is.</SectionFooter>

        <ScreenSectionHeader title="What goes out" />
        <Section>
          {CHANNELS.map(({ name, field }) => (
            <Row key={field} label={name} description={textFor(field) || 'Nothing yet'} />
          ))}
        </Section>

        <ScreenSectionHeader title="What the field holds" />
        <Card padded>
          <Text variant="hint" selectable>
            {JSON.stringify(content)}
          </Text>
        </Card>
      </DetailScrollView>
      <MentionContactSheet contact={pressedContact} onClose={() => setPressedId(null)} onOpenContact={openContact} />
    </Page>
  );
}

/** A contact's handles in one line: "@sam on X · @sam.bsky.social on Bluesky". */
function handlesText(contact: Partial<Record<ContactHandleField, string | null>>) {
  return CONTACT_HANDLES.filter(({ field }) => contact[field])
    .map(({ field, label }) => `@${contact[field]} on ${label}`)
    .join(' · ');
}

const styles = StyleSheet.create({
  suggestions: {
    marginTop: space.sm,
    borderRadius: radii.cover,
    backgroundColor: colors.background.muted,
  },
});
