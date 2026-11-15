import { MENTION_CHIP } from './fieldContent';

// Longer than any name typed to find a contact: past this the user writes something else.
const MAX_QUERY = 40;
// What an @ may follow to start a mention: the text's start, a space, a line break or a chip.
const BOUNDARY = new RegExp(String.raw`[\s${MENTION_CHIP}]`);

export type TypedMention = { start: number; end: number; query: string };

/**
 * The @ being typed up to the cursor in the field's `text` (MENTION_CHIP for each chip), the cursor
 * at `cursor` (a collapsed selection): an @ at the start or after a space, a line break or a chip,
 * then up to MAX_QUERY characters to the cursor with no line break or chip among them, so a name with
 * spaces matches. Where its @ is (`start`), the cursor (`end`) and what was typed after the @
 * (`query`); null when none is being typed (an email address is none).
 */
export default function mentionAt(text: string, cursor: number): TypedMention | null {
  for (let i = cursor - 1; i >= 0 && cursor - i <= MAX_QUERY + 1; i--) {
    const character = text[i]!;
    if (character === MENTION_CHIP || character === '\n') return null;
    if (character !== '@') continue;
    if (i > 0 && !BOUNDARY.test(text[i - 1]!)) return null;
    return { start: i, end: cursor, query: text.slice(i + 1, cursor) };
  }
  return null;
}
