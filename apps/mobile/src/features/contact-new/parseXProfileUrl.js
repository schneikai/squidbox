import { CONTACT_HANDLE_BY_FIELD } from '@squidbox/shared';

// The hosts an X profile is linked from (CONTACT_HANDLES, which normalizeHandle strips too).
const X_HOSTS = CONTACT_HANDLE_BY_FIELD.xHandle.hosts;
// What follows the host in a profile link: an X handle (letters, digits and underscores; X allows up
// to 15, older ones can be longer), then nothing but a query or fragment. A post's link has more path.
const PROFILE_PATH = /^@?([A-Za-z0-9_]{1,50})\/?(?:[?#].*)?$/;
// Paths of x.com that are pages, not profiles.
const NOT_PROFILES = new Set([
  'home',
  'explore',
  'search',
  'notifications',
  'messages',
  'settings',
  'i',
  'intent',
  'share',
]);

/**
 * The profile an X link points at (`https://x.com/MayaL?s=21`, a twitter.com one too): `{ handle,
 * url }` with the handle lowercased, or null for anything else (a post's link, another site).
 */
export default function parseXProfileUrl(text) {
  const url = text?.trim();
  const address = url?.match(/^https?:\/\/(?:www\.)?(.*)$/i)?.[1];
  const host = address && X_HOSTS.find((prefix) => address.toLowerCase().startsWith(prefix));
  const match = host && address.slice(host.length).match(PROFILE_PATH);
  if (!match || NOT_PROFILES.has(match[1].toLowerCase())) return null;
  return { handle: match[1].toLowerCase(), url };
}
