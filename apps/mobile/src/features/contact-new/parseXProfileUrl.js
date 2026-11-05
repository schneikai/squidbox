// An X handle: letters, digits and underscores (X allows up to 15; older ones can be longer).
const PROFILE_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,50})\/?(?:[?#].*)?$/;
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
  const match = url?.match(PROFILE_URL);
  if (!match || NOT_PROFILES.has(match[1].toLowerCase())) return null;
  return { handle: match[1].toLowerCase(), url };
}
