import { HANDLE_BODY } from '@/lib/extractHandles';

// The handle being typed up to the cursor: an @ at the start or after anything but a word character
// or another @ (so an email address isn't one), then a handle (or nothing yet), maybe with the dot or
// hyphen that goes on to its next part.
const TYPED = new RegExp(String.raw`(?<![\w@])@((?:${HANDLE_BODY}[.-]?)?)$`);
// The rest of the handle after the cursor, replaced with it; not a dot or hyphen that ends a sentence.
const REST = /^\w*(?:[.-]\w+)*/;
// Longer than any handle: past this the user writes something else.
const MAX_QUERY = 50;

export type TypedMention = { start: number; end: number; query: string };

/**
 * The @handle the cursor is in, in `text` with the cursor at `cursor` (a collapsed selection): where
 * its @ is (`start`), where the handle ends (`end`, past the cursor when it sits inside one) and what
 * was typed between them before the cursor (`query`, without the @); null when the cursor isn't in
 * one.
 */
export default function mentionAt(text: string, cursor: number): TypedMention | null {
  const typed = TYPED.exec(text.slice(0, cursor));
  if (!typed || typed[1].length > MAX_QUERY) return null;
  const [rest] = REST.exec(text.slice(cursor)) as RegExpExecArray;
  return { start: typed.index, end: cursor + rest.length, query: typed[1] };
}
