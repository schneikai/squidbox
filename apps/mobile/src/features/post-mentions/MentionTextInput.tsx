import { POST_LIMITS, type Channel, type PostMention } from '@squidbox/shared';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import MentionInput, { type FieldSelection, type MentionInputHandle } from './MentionInput';
import MentionSuggestions from './MentionSuggestions';
import { fromFieldContent, toFieldContent, type FieldContent } from './fieldContent';
import type { MentionContact } from './mentionHandle';
import mentionLabel from './mentionLabel';
import type { MentionTextValue } from './mentionParts';
import useChipAvatarUri from './useChipAvatarUri';
import useMentionAutocomplete from './useMentionAutocomplete';

type MentionTextInputProps = {
  /** The text and its mentions, as a post stores them. */
  value: MentionTextValue;
  onChange: (value: MentionTextValue) => void;
  /** The channel a copy is for: its chips read as the contacts' handles there. */
  channel?: Pick<Channel, 'handleField'>;
  contactsById: ReadonlyMap<string, MentionContact>;
  placeholder?: string;
  minHeight: number;
  autoFocus?: boolean;
  /** Whether the contacts an @ may mean show (the card being edited). */
  isActive: boolean;
  /** The post's photos, whose contacts the suggestions list first. */
  assetIds: string[];
  onPressMention?: (contactId: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

/**
 * A post's text with its mentions as chips inside it (MentionInput), and under it, while `isActive`,
 * the contacts the @ being typed may mean (MentionSuggestions); a tap on one puts its chip in place
 * of the @. The value is the stored form ({ text, mentions }): the field gets it at mount and again
 * whenever it is not the value it last reported (Write with AI's Use, a relink, a chip's label that
 * changed), and reports only its own changes, so opening a post that mentions a renamed contact
 * leaves it unchanged. No suggestions once the text has POST_LIMITS.mentions.
 */
export default function MentionTextInput({
  value,
  onChange,
  channel,
  contactsById,
  placeholder,
  minHeight,
  autoFocus = false,
  isActive,
  assetIds,
  onPressMention,
  onFocus,
  onBlur,
}: MentionTextInputProps) {
  const inputRef = useRef<MentionInputHandle>(null);
  // The field's content as it holds it, by contentKey: set to it, or derived from its report.
  const heldRef = useRef<string | null>(null);
  const avatarUriOf = useChipAvatarUri();
  const autocomplete = useMentionAutocomplete();
  const { onSetContent } = autocomplete;

  const chipOf = (mention: PostMention) => ({
    label: mentionLabel(mention, contactsById, channel),
    avatarUri: avatarUriOf(contactsById.get(mention.contactId)),
  });
  const content = toFieldContent(value, chipOf);
  const key = contentKey(content);
  const mention = isActive && (value.mentions?.length ?? 0) < POST_LIMITS.mentions ? autocomplete.mention : null;

  useEffect(() => {
    if (key === heldRef.current) return;
    const isFirst = heldRef.current === null;
    heldRef.current = key;
    onSetContent(content.text);
    inputRef.current
      ?.setContent(content)
      .then(() => (isFirst && autoFocus ? inputRef.current?.focus() : undefined))
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the content is the key's: set again only when it changes
  }, [key]);

  function handleChangeContent(next: FieldContent, selection: FieldSelection) {
    const stored = fromFieldContent(next, (chip) => contactsById.get(chip.id)?.name ?? chip.label);
    heldRef.current = contentKey(toFieldContent(stored, chipOf));
    autocomplete.onContent(next.text, selection);
    onChange(stored);
  }

  function pick(contact: MentionContact) {
    if (!mention) return;
    const label = mentionLabel({ contactId: contact.id, location: 0, name: contact.name }, contactsById, channel);
    inputRef.current
      ?.insertMention(contact.id, label, avatarUriOf(contact), mention.start, mention.end)
      .catch(console.error);
  }

  return (
    <View style={styles.column}>
      <MentionInput
        ref={inputRef}
        placeholder={placeholder}
        minHeight={minHeight}
        onChangeContent={handleChangeContent}
        onSelectionChange={autocomplete.onSelection}
        onFocusChange={(isFocused) => (isFocused ? onFocus?.() : onBlur?.())}
        onMentionPress={onPressMention}
      />
      {mention && (
        <MentionSuggestions query={mention.query} contactsById={contactsById} assetIds={assetIds} onPick={pick} />
      )}
    </View>
  );
}

// The content as one string, to tell whether the field holds it.
function contentKey({ text, mentions }: FieldContent): string {
  return JSON.stringify([
    text,
    mentions.map(({ id, label, location, avatarUri }) => [id, label, location, avatarUri ?? null]),
  ]);
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
  },
});
