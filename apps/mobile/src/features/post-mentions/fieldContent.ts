import type { PostMention } from '@squidbox/shared';

import mentionParts, { type MentionTextValue } from './mentionParts';
import replaceWithMentions, { type MentionRange } from './replaceWithMentions';

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
  const ranges: MentionRange[] = [];
  for (let at = content.text.indexOf(MENTION_CHIP); at !== -1; at = content.text.indexOf(MENTION_CHIP, at + 1)) {
    const chip = byLocation.get(at);
    ranges.push({ from: at, to: at + 1, mention: chip ? { contactId: chip.id, name: nameOf(chip) } : null });
  }
  return replaceWithMentions(content.text, ranges);
}
