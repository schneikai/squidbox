import type { PostMention } from '@squidbox/shared';

import mentionParts, { type MentionTextValue } from './mentionParts';

/** The character a chip is in the mention field's text (MentionInput). */
export const MENTION_CHIP = '￼';

/** A chip in the field: its contact's id, its label, where it is in the field's text, its avatar's file. */
export type FieldMention = { id: string; label: string; location: number; avatarUri?: string | null };
/** What the mention field holds: its text, each chip one MENTION_CHIP at its `location`. */
export type FieldContent = { text: string; mentions: FieldMention[] };

/**
 * A stored text with its mentions (`value`) as the field holds it: each valid mention (mentionParts)
 * one MENTION_CHIP, with the label and avatar `chipOf` gives it.
 */
export function toFieldContent(
  value: MentionTextValue,
  chipOf: (mention: PostMention) => Pick<FieldMention, 'label' | 'avatarUri'>,
): FieldContent {
  let text = '';
  const mentions: FieldMention[] = [];
  for (const part of mentionParts(value.text, value.mentions)) {
    if (part.kind === 'text') {
      text += part.text;
      continue;
    }
    mentions.push({ id: part.mention.contactId, location: text.length, ...chipOf(part.mention) });
    text += MENTION_CHIP;
  }
  return { text, mentions };
}

/**
 * The field's content as a post stores it: each chip written as its contact's name (`nameOf`, the
 * contact's name now; a chip whose contact is gone keeps its label), a MENTION_CHIP without a chip
 * dropped. Mentions null when there is none.
 */
export function fromFieldContent(content: FieldContent, nameOf: (mention: FieldMention) => string): MentionTextValue {
  const byLocation = new Map(content.mentions.map((mention) => [mention.location, mention]));
  let text = '';
  const mentions: PostMention[] = [];
  for (let i = 0; i < content.text.length; i++) {
    const character = content.text[i]!;
    if (character !== MENTION_CHIP) {
      text += character;
      continue;
    }
    const chip = byLocation.get(i);
    if (!chip) continue;
    const name = nameOf(chip);
    mentions.push({ contactId: chip.id, location: text.length, name });
    text += name;
  }
  return { text, mentions: mentions.length > 0 ? mentions : null };
}
