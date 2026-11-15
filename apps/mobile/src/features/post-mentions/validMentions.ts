import type { PostMention } from '@squidbox/shared';

import mentionParts, { type MentionTextValue } from './mentionParts';

/** The mentions of `value` that count (mentionParts': each whose name still stands at its place), in order. */
export default function validMentions(value: MentionTextValue): PostMention[] {
  return mentionParts(value.text, value.mentions).flatMap((part) => (part.kind === 'mention' ? [part.mention] : []));
}
