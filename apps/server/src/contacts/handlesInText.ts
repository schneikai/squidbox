// The deterministic handle pass of From link: the other networks' handles a profile's bio and
// website name as a profile link (or, for Bluesky, as a bare *.bsky.social handle).
import { CONTACT_HANDLE_BY_FIELD, OTHER_HANDLE_FIELDS, normalizeHandle, type OtherHandleField } from '@squidbox/shared';
import { escapeRegExp } from '../escapeRegExp.js';

// Each network's patterns with the host its match is a handle of: a profile link of each of its
// hosts (`onlyfans.com/mayal/c17`), and for Bluesky the bare form bios write (`Maya.bsky.social`).
// Each starts a word or follows a subdomain's dot (not `notonlyfans.com`), and a handle runs to its
// end: one followed by `:` is a DID (`bsky.app/profile/did:plc:…`), not a handle, and is skipped.
const START = String.raw`(?<![A-Za-z0-9_-])`;
const HANDLE = String.raw`([A-Za-z0-9_.-]+)(?![A-Za-z0-9_.:-])`;
const PATTERNS: { field: OtherHandleField; host: string; pattern: RegExp }[] = [
  ...OTHER_HANDLE_FIELDS.flatMap((field) =>
    CONTACT_HANDLE_BY_FIELD[field].hosts.map((host) => ({
      field,
      host,
      pattern: new RegExp(String.raw`${START}(?:https?:\/\/)?(?:www\.)?${escapeRegExp(host)}${HANDLE}`, 'i'),
    })),
  ),
  {
    field: 'blueskyHandle',
    host: '',
    pattern: new RegExp(String.raw`${START}@?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.bsky\.social)(?![A-Za-z0-9_-])`, 'i'),
  },
];

/**
 * The Bluesky, OnlyFans and JFF handles `texts` name, the first one of each network, normalized
 * (normalizeHandle: lowercased, the path or query after it gone). A custom-domain Bluesky handle is
 * the assistant's to find.
 */
export function handlesInText(texts: string[]): Partial<Record<OtherHandleField, string>> {
  const found: Partial<Record<OtherHandleField, string>> = {};
  for (const text of texts)
    for (const { field, host, pattern } of PATTERNS) {
      if (found[field]) continue;
      const match = text.match(pattern)?.[1];
      // A sentence's full stop after a link is not part of the handle.
      const handle = match && normalizeHandle(host + match).replace(/\.+$/, '');
      if (handle) found[field] = handle;
    }
  return found;
}
