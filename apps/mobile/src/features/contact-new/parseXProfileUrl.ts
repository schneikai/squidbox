import { parseHandle } from '@squidbox/shared';

/**
 * The profile an X link points at (`https://x.com/MayaL?s=21`, a twitter.com one or a post's link
 * too, parseHandle): `{ handle, url }` with the handle's case as in the link, or null for anything
 * else (a page of X that is no profile, another site, a handle typed without a link).
 */
export type XProfileLink = { handle: string; url: string };

export default function parseXProfileUrl(text: string | null | undefined): XProfileLink | null {
  const url = text?.trim() ?? '';
  const parsed = parseHandle(url, 'xHandle');
  // The clipboard holds a link with its scheme (parseHandle adds one to a link typed without), not a
  // handle or an address someone typed.
  if (parsed.kind !== 'link' || parsed.url !== url || parsed.field !== 'xHandle' || !parsed.handle) return null;
  return { handle: parsed.handle, url };
}
