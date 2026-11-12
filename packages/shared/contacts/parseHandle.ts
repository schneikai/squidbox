import { CONTACT_HANDLES, type ContactHandleField } from '../collections/contact';

/**
 * What a handle's text is (parseHandle): nothing, a handle, or a link. `handle` is the bare handle,
 * case kept, in every kind: null when empty, a link's profile handle (null when it isn't a profile's
 * link, or is another network's than the field read). A link has its `url` (with `https://` when typed without a scheme), its `address` (without
 * scheme and `www.`) and the network whose host it is (`field`, null for another site).
 */
export type ParsedHandle =
  | { kind: 'empty'; handle: null }
  | { kind: 'handle'; handle: string }
  | { kind: 'link'; handle: string | null; url: string; address: string; field: ContactHandleField | null };

// A scheme, then a `www.`, which a link may start with and its host is found without.
const SCHEME = /^https?:\/\//i;
const WWW = /^www\./i;
// Every network's hosts, each with its network.
const HOSTS = CONTACT_HANDLES.flatMap((network) => network.hosts.map((host) => ({ network, host })));

/**
 * A handle's text as typed (in `field`, when given), read without changing it: empty ('', spaces or only `@`s); a handle
 * ('@MayaL' → 'MayaL', trimmed and without its leading `@`s, case kept); or a link, when it starts
 * with `http(s)://`, `www.` or a network's host (CONTACT_HANDLES' `hosts`). A link's `handle` is the
 * profile's, from the path's first segment after the host (a leading `@` dropped) when the network's
 * `handleSegment` takes it and it isn't one of its `reserved` pages: `x.com/MayaL/status/1` is
 * MayaL's, `x.com/i/lists/1` no one's. Read for a field, another network's profile is no handle of
 * that field: `instagram.com/maya` in the X field is just a link.
 */
export function parseHandle(text: string, field?: ContactHandleField): ParsedHandle {
  const trimmed = text.trim();
  const bare = trimmed.replace(/^@+/, '').trim();
  if (!bare) return { kind: 'empty', handle: null };
  const hasScheme = SCHEME.test(trimmed);
  const withoutScheme = hasScheme ? trimmed.replace(SCHEME, '') : trimmed;
  const address = withoutScheme.replace(WWW, '');
  const lower = address.toLowerCase();
  const match = HOSTS.find(({ host }) => lower.startsWith(host));
  if (!match && !hasScheme && address === withoutScheme) return { kind: 'handle', handle: bare };
  const url = hasScheme ? trimmed : `https://${trimmed}`;
  if (!match) return { kind: 'link', handle: null, url, address, field: null };
  const { network, host } = match;
  if (field && field !== network.field) return { kind: 'link', handle: null, url, address, field: network.field };
  const segment = address.slice(host.length).split(/[/?#]/)[0]!.replace(/^@/, '');
  const handle = network.reserved.has(segment.toLowerCase())
    ? null
    : (network.handleSegment.exec(segment)?.[1] ?? null);
  return { kind: 'link', handle, url, address, field: network.field };
}
