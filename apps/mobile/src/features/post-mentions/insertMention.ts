import type { TypedMention } from './mentionAt';

/**
 * `text` with the typed `mention` (mentionAt) replaced by `@handle` and a space after it (the one
 * that follows already, else a new one), and where the cursor goes: after that space.
 */
export default function insertMention(
  text: string,
  mention: Pick<TypedMention, 'start' | 'end'>,
  handle: string,
): { text: string; cursor: number } {
  const after = text.slice(mention.end);
  const written = `@${handle}`;
  const next = text.slice(0, mention.start) + written + (/^\s/.test(after) ? '' : ' ') + after;
  return { text: next, cursor: mention.start + written.length + 1 };
}
