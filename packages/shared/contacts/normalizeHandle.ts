// The profile URLs a handle may be pasted as, without their scheme or `www.`.
const PROFILE_HOSTS = ['x.com/', 'twitter.com/', 'bsky.app/profile/', 'onlyfans.com/', 'justfor.fans/'];

/**
 * A handle as contacts store it: trimmed and lowercased, without a leading `@`, and from a pasted
 * profile URL only the handle (`https://x.com/MayaL?s=21` → `mayal`). Empty for an empty input.
 */
export function normalizeHandle(input: string): string {
  let handle = input.trim().toLowerCase();
  for (const prefix of ['https://', 'http://', 'www.'])
    if (handle.startsWith(prefix)) handle = handle.slice(prefix.length);
  const host = PROFILE_HOSTS.find((prefix) => handle.startsWith(prefix));
  if (host) handle = handle.slice(host.length);
  if (handle.startsWith('@')) handle = handle.slice(1);
  return handle.split(/[/?#]/)[0]!;
}
