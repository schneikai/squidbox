// The assistant's mention markers: `@[Sam Ridge]` in a reply marks a contact it mentions, by the
// name it was given. They live only on the wire between the app, the server and the model (the app
// turns them into chips when the reply lands, the server takes them off for builds that don't read
// them); nothing stored or synced holds one. The one place that knows their form and compares names.
import { CONTACT_LIMITS } from './collections/contact';

/** A marked name in a text: where it starts (UTF-16 offset) and the name as given. */
export type MentionMark = { location: number; name: string };

const OPEN = '@[';
const CLOSE = ']';
// What a marker's name never holds: a `[` or `]`, or a line break.
const NOT_IN_NAME = /[[\]\r\n]/;
const NO_NAMES: ReadonlyMap<string, string> = new Map();
// What a marker never follows: it starts a word ("frames@[3]" is no marker).
const IN_WORD = /[\p{L}\p{N}_@]/u;

/**
 * What a name is compared by: trimmed, without one leading `@` (a handle's habit), its spaces
 * collapsed, without case. Two names are the same name when their keys are equal.
 */
function key(name: string): string {
  return name.trim().replace(/^@/, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * `text` with its markers read against `names` (the names the turn was told, by their `key`). A
 * marker is a `@[` that starts a word, or a `@@[` that does (an @ the model added out of habit). At
 * each: when a `]` follows with no `[` or line break before it, at most CONTACT_LIMITS.name on, and
 * its key is one of `names`, that name as given stands there with a mark (an added @ goes with it);
 * with no such name the inner text, trimmed, stays as plain text; a broken one loses only its `@[`.
 * Any other `@[` stays as written. Marks are at their places in the returned text.
 */
function read(text: string, names: ReadonlyMap<string, string>): { text: string; marks: MentionMark[] } {
  let result = '';
  const marks: MentionMark[] = [];
  let at = 0;
  for (let open = text.indexOf(OPEN); open >= 0; open = text.indexOf(OPEN, Math.max(at, open + 1))) {
    const hasAddedAt = text[open - 1] === '@' && !IN_WORD.test(text[open - 2] ?? '');
    if (!hasAddedAt && IN_WORD.test(text[open - 1] ?? '')) continue;
    result += text.slice(at, open);
    const start = open + OPEN.length;
    const close = closeOf(text, start);
    if (close === null) {
      at = start;
      continue;
    }
    const inner = text.slice(start, close);
    const name = names.get(key(inner));
    if (name) {
      if (hasAddedAt) result = result.slice(0, -1);
      marks.push({ location: result.length, name });
      result += name;
    } else {
      result += inner.trim();
    }
    at = close + CLOSE.length;
  }
  return { text: result + text.slice(at), marks };
}

// Where the marker opened at `start` closes: the first `]`, when nothing a name never holds comes
// before it and the name is no longer than a contact's; else null (broken).
function closeOf(text: string, start: number): number | null {
  for (let at = start; at < text.length && at - start <= CONTACT_LIMITS.name; at++) {
    if (text[at] === CLOSE) return at;
    if (NOT_IN_NAME.test(text[at]!)) return null;
  }
  return null;
}

/** `name` as a marker, `@[name]`; a name that couldn't be read back from one (it holds `[`, `]` or a line break) as it is. */
function mark(name: string): string {
  return name && !NOT_IN_NAME.test(name) ? `${OPEN}${name}${CLOSE}` : name;
}

/** `text` without markers, for a reader that knows none: each marked name as plain text. */
function strip(text: string): string {
  return read(text, NO_NAMES).text;
}

export const mentionMarkers = { key, read, mark, strip };
