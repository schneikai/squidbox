// The assistant's mention markers: `@[Sam Ridge]` in a reply marks a contact it mentions, by the
// name it was given. They live only on the wire between the app, the server and the model (the app
// turns them into chips when the reply lands, the server takes them off for builds that don't read
// them); nothing stored or synced holds one. The one place that knows their form and compares names.
import { CONTACT_LIMITS } from './collections/contact';

/** A marked name in a text: where it starts (UTF-16 offset) and the name as given. */
export type MentionMark = { location: number; name: string };

const OPEN = '@[';
const CLOSE = ']';
// A name that could not be read back from a marker.
const UNMARKABLE = /[[\]\r\n]/;

/** What a name is compared by: trimmed, its spaces collapsed, without case. Two names are the same name when their keys are equal. */
function key(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * `text` with its markers read against `names` (the names the turn was told). At each `@[`: when a
 * `]` follows on the same line, the inner text holds no `[` and is at most CONTACT_LIMITS.name long,
 * and its key equals the key of exactly one distinct given name, that name as given stands there
 * with a mark; with no such name (unknown, or two given names that differ only in case or spaces)
 * the inner text, trimmed, stays as plain text; anything else (broken, or no marker at all) loses
 * only its `@[`. Marks are at their places in the returned text.
 */
function read(text: string, names: readonly string[]): { text: string; marks: MentionMark[] } {
  const byKey = new Map<string, Set<string>>();
  for (const name of names) {
    const nameKey = key(name);
    if (nameKey) byKey.set(nameKey, (byKey.get(nameKey) ?? new Set()).add(name));
  }
  let result = '';
  const marks: MentionMark[] = [];
  let at = 0;
  for (let open = text.indexOf(OPEN); open >= 0; open = text.indexOf(OPEN, at)) {
    result += text.slice(at, open);
    const start = open + OPEN.length;
    const close = closeOf(text, start);
    if (close === null) {
      at = start;
      continue;
    }
    const inner = text.slice(start, close);
    const matches = byKey.get(key(inner));
    if (matches?.size === 1) {
      const [name] = matches as Set<string>;
      marks.push({ location: result.length, name: name! });
      result += name;
    } else {
      result += inner.trim();
    }
    at = close + CLOSE.length;
  }
  return { text: result + text.slice(at), marks };
}

// Where the marker opened at `start` closes: the first `]` on its line, when no `[` comes before it
// and the name is no longer than a contact's; else null (broken).
function closeOf(text: string, start: number): number | null {
  for (let at = start; at < text.length && at - start <= CONTACT_LIMITS.name; at++) {
    const char = text[at];
    if (char === CLOSE) return at;
    if (char === '[' || char === '\n' || char === '\r') return null;
  }
  return null;
}

/**
 * The inverse of `read`: `text` with `@[name]` around each mark. A mark whose name doesn't stand at
 * its place, overlaps an earlier one, or holds `[`, `]` or a line break (it couldn't be read back)
 * stays plain text.
 */
function write(text: string, marks: readonly MentionMark[]): string {
  let result = '';
  let at = 0;
  for (const { location, name } of [...marks].sort((a, b) => a.location - b.location)) {
    if (location < at || !name || UNMARKABLE.test(name) || !text.startsWith(name, location)) continue;
    result += `${text.slice(at, location)}${OPEN}${name}${CLOSE}`;
    at = location + name.length;
  }
  return result + text.slice(at);
}

/** `text` without markers, for a reader that knows none: each marked name as plain text. */
function strip(text: string): string {
  return read(text, []).text;
}

export const mentionMarkers = { key, read, write, strip };
