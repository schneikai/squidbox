import { POST_LIMITS, type Channel, type PostMention } from '@squidbox/shared';
import { useCallback, useEffect, useRef } from 'react';
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
  // What the field holds: the stored value it was set to or last reported, the chipOf it was drawn
  // with, and its content (worked out only when a new value has to be compared with it).
  const heldRef = useRef<Held | null>(null);
  const avatarUriOf = useChipAvatarUri();
  const autocomplete = useMentionAutocomplete();
  const { onSetContent } = autocomplete;
  const { text, mentions } = value;

  const chipOf = useCallback(
    (mention: PostMention) => ({
      label: mentionLabel(mention, contactsById, channel),
      avatarUri: avatarUriOf(contactsById.get(mention.contactId)),
    }),
    [avatarUriOf, channel, contactsById],
  );
  const mention = isActive && (mentions?.length ?? 0) < POST_LIMITS.mentions ? autocomplete.mention : null;

  // A keystroke's value comes back as the same text and mentions the field reported: nothing to do.
  useEffect(() => {
    const held = heldRef.current;
    if (held && held.value.text === text && held.value.mentions === mentions && held.chipOf === chipOf) return;
    const content = toFieldContent({ text, mentions }, chipOf);
    heldRef.current = { value: { text, mentions }, chipOf, content };
    if (held && isSameContent((held.content ??= toFieldContent(held.value, held.chipOf)), content)) return;
    onSetContent(content.text);
    inputRef.current
      ?.setContent(content)
      .then(() => (!held && autoFocus ? inputRef.current?.focus() : undefined))
      .catch(console.error);
  }, [autoFocus, chipOf, mentions, onSetContent, text]);

  function handleChangeContent(next: FieldContent, selection: FieldSelection) {
    const stored = fromFieldContent(next, (chip) => contactsById.get(chip.id)?.name ?? chip.label);
    heldRef.current = { value: stored, chipOf };
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

type Held = {
  value: MentionTextValue;
  chipOf: (mention: PostMention) => Pick<FieldContent['mentions'][number], 'label' | 'avatarUri'>;
  content?: FieldContent;
};

// Whether the field holding `a` already shows `b`: the same text, and the same chips in the same places.
function isSameContent(a: FieldContent, b: FieldContent): boolean {
  return (
    a.text === b.text &&
    a.mentions.length === b.mentions.length &&
    a.mentions.every((chip, i) => {
      const other = b.mentions[i]!;
      return (
        chip.id === other.id &&
        chip.label === other.label &&
        chip.location === other.location &&
        (chip.avatarUri ?? null) === (other.avatarUri ?? null)
      );
    })
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
  },
});
