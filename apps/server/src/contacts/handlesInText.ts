// The deterministic handle pass of From link: the other networks' handles a profile's bio, website
// and links name as a profile link (or, for Bluesky, as a bare *.bsky.social handle).
import { CONTACT_HANDLES, normalizeHandle, type ContactHandleField } from '@squidbox/shared';

type OtherHandleField = Exclude<ContactHandleField, 'xHandle'>;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Each network's patterns with the host its match is a handle of: a profile link of each of its
// hosts (`onlyfans.com/mayal/c17`), and for Bluesky the bare form bios write (`Maya.bsky.social`).
const PATTERNS: { field: OtherHandleField; host: string; pattern: RegExp }[] = [
  ...CONTACT_HANDLES.filter(
    (handle): handle is Extract<(typeof CONTACT_HANDLES)[number], { field: OtherHandleField }> =>
      handle.field !== 'xHandle',
  ).flatMap(({ field, hosts }) =>
    hosts.map((host) => ({
      field,
      host,
      pattern: new RegExp(String.raw`(?:https?:\/\/)?(?:www\.)?${escape(host)}([A-Za-z0-9_.-]+)`, 'i'),
    })),
  ),
  { field: 'blueskyHandle', host: '', pattern: /@?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.bsky\.social)/i },
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
