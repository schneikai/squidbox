import type { PostMention } from '@squidbox/shared';

/** A piece of a text with mentions: plain text, or a mention whose name stands there. */
export type MentionPart = { kind: 'text'; text: string } | { kind: 'mention'; mention: PostMention };

/**
 * `text` cut into its plain runs and its mentions, in order. A mention counts only where the text
 * still has its name at its location (`text.startsWith(name, location)`); one that overlaps an
 * earlier one, or points past the text, is dropped and its words read as plain text. Without valid
 * mentions it is the text alone (no part for an empty text).
 */
export default function mentionParts(text: string, mentions: readonly PostMention[] | null | undefined): MentionPart[] {
  const parts: MentionPart[] = [];
  let at = 0;
  const sorted = [...(mentions ?? [])].sort((a, b) => a.location - b.location);
  for (const mention of sorted) {
    if (mention.location < at || !text.startsWith(mention.name, mention.location)) continue;
    if (mention.location > at) parts.push({ kind: 'text', text: text.slice(at, mention.location) });
    parts.push({ kind: 'mention', mention });
    at = mention.location + mention.name.length;
  }
  if (at < text.length) parts.push({ kind: 'text', text: text.slice(at) });
  return parts;
}
