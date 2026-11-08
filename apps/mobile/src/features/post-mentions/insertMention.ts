import type { TypedMention } from './mentionAt';

/**
 * `text` with the typed `mention` (mentionAt) replaced by `@handle`, and where the cursor goes: right
 * after it, or after a space added when the handle ends the text, so the next word can follow.
 * Whatever came after the handle (a space, a comma, a new line) stays as it was.
 */
export default function insertMention(
  text: string,
  mention: Pick<TypedMention, 'start' | 'end'>,
  handle: string,
): { text: string; cursor: number } {
  const after = text.slice(mention.end);
  const written = `@${handle}${after === '' ? ' ' : ''}`;
  return { text: text.slice(0, mention.start) + written + after, cursor: mention.start + written.length };
}
