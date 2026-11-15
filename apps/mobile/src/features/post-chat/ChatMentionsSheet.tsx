import { CHAT_LIMITS } from '@squidbox/shared';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import canBeChatMention from './canBeChatMention';
import type { LiveChat } from './useChatSession';
import type { Mentions } from './useMentions';

import BottomSheet from '@/components/BottomSheet';
import IntroText from '@/components/IntroText';
import TagsField from '@/components/TagsField';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import useContactRows from '@/features/contact-list/useContactRows';
import MentionSuggestions from '@/features/post-mentions/MentionSuggestions';
import type { MentionContact } from '@/features/post-mentions/mentionHandle';
import { space } from '@/styles/designTokens';
import tagsDifference from '@/utils/tagsDifference';

type ChatMentionsSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  mentions: Mentions;
  // The post's photos: their contacts come first among the suggestions.
  assetIds: string[];
  onEditMentions: LiveChat['editMentions'];
};

/**
 * The contacts the chat may mention, in a sheet (`mentions`), as chips edited in place like its tags:
 * a × takes one off, and Add searches the contacts that may be one (MentionSuggestions over those
 * not there yet that canBeChatMention, those on the photos `assetIds` first), a tap adding one; what
 * is typed alone adds nothing. Each change is the chat's only (`onEditMentions({ add, remove })`, by
 * contact id), never the posts'.
 */
export default function ChatMentionsSheet({
  isVisible,
  onClose,
  mentions,
  assetIds,
  onEditMentions,
}: ChatMentionsSheetProps) {
  const ids = useMemo(() => mentions.map((contact) => contact.id), [mentions]);
  const byId = useMemo(() => new Map(mentions.map((contact) => [contact.id, contact])), [mentions]);

  function chipOf(id: string) {
    const contact = byId.get(id);
    if (!contact) return { label: id };
    return { label: contact.name, leading: <ContactAvatar contact={contact} size="chip" /> };
  }

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} title="Mentions">
      <View style={styles.body}>
        <IntroText>Who the assistant may mention in this chat. Your posts stay as they are.</IntroText>
        <TagsField
          tags={ids}
          onChange={(next) => onEditMentions(tagsDifference(ids, next))}
          placeholder="No mentions"
          maxTags={CHAT_LIMITS.mentions}
          itemName="contact"
          chipOf={chipOf}
          isPickOnly
          renderSuggestions={(text, add) => (
            <ContactSuggestions
              query={text.trim().replace(/^@/, '')}
              assetIds={assetIds}
              taken={byId}
              onPick={(contact) => add(contact.id)}
            />
          )}
        />
      </View>
    </BottomSheet>
  );
}

type ContactSuggestionsProps = {
  query: string;
  assetIds: string[];
  taken: ReadonlyMap<string, MentionContact>;
  onPick: (contact: MentionContact) => void;
};

// The contacts Add may add (MentionSuggestions), read only while Add is open: every contact that can
// be a chat mention and isn't one yet (`taken`).
function ContactSuggestions({ query, assetIds, taken, onPick }: ContactSuggestionsProps) {
  const contacts = useContactRows({});

  const contactsById = useMemo(
    () =>
      new Map(
        (contacts ?? [])
          .filter((contact) => !taken.has(contact.id) && canBeChatMention(contact))
          .map((contact) => [contact.id, contact]),
      ),
    [contacts, taken],
  );

  return <MentionSuggestions query={query} contactsById={contactsById} assetIds={assetIds} onPick={onPick} />;
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
  },
});
