// Reading a public X profile page (From link on a New contact): an anonymous GET of x.com/<handle>,
// parsed without running anything. The page holds the profile twice: TanStack Router's TSR object
// (name, bio with t.co links, location, avatar, profile status), which every variant of the page
// has, and Relay's `UserByScreenName` JSON (the t.co links expanded, the website), which the full
// page has. The HTML is never stored or logged.
import type { FastifyBaseLogger } from 'fastify';
import { CONTACT_HANDLE_BY_FIELD } from '@squidbox/shared';
import { withTimeout } from '../requestSignal.js';
import { decodeJsStringLiteral } from './jsStringLiteral.js';
import { readCappedBody } from './readCappedBody.js';
import { USER_AGENT } from './userAgent.js';

/**
 * What a profile page showed: a `found` profile's fields ('' for one that isn't there, null for no
 * avatar); `unavailable` (hidden from signed-out readers) and `notFound` nothing; `failed` why, in
 * words (never the HTML).
 */
export type XProfilePage =
  | {
      status: 'found';
      isProtected: boolean;
      name: string;
      bio: string;
      location: string;
      website: string;
      avatarUrl: string | null;
    }
  | { status: 'unavailable' | 'notFound' }
  | { status: 'failed'; reason: string };

// The body of a JS or JSON string literal: up to its first unescaped quote.
const STRING_BODY = String.raw`((?:[^"\\]|\\[\s\S])*)`;
const PROFILE_STATUS_KEY = /[{,]profileStatus:"/;
const PROFILE_STATUS = /[{,]profileStatus:"([A-Za-z]+)"/;
const RELAY_RESULT = new RegExp(String.raw`kind:"Result\.Ok",value:"${STRING_BODY}"`, 'g');
const TSR_STRINGS = Object.fromEntries(
  ['name', 'description', 'location', 'avatarUrl'].map((key) => [
    key,
    new RegExp(String.raw`[{,]${key}:"${STRING_BODY}"`),
  ]),
) as Record<'name' | 'description' | 'location' | 'avatarUrl', RegExp>;
const OG_TITLE_NAME = /^(.*) \(@\w+\) on X$/;
const HTML_ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

// The profile's Relay record, as far as it is read.
type RelayUser = {
  profile_bio?: {
    entities?: {
      description?: { urls?: { url?: string; expanded_url?: string }[] };
      url?: { urls?: { expanded_url?: string }[] };
    };
  };
  privacy?: { protected?: boolean };
};

/**
 * The flat part of the TSR object that holds `profileStatus` (`l:$R[n]={…}` up to its first nested
 * `$R[`), or null when the page has none.
 */
function tsrObject(html: string): string | null {
  const status = html.search(PROFILE_STATUS_KEY);
  if (status === -1) return null;
  const start = html.lastIndexOf('l:$R[', status);
  if (start === -1) return null;
  const open = html.indexOf('{', start);
  const nested = html.indexOf('$R[', open);
  return html.slice(open, nested === -1 || nested < status ? undefined : nested);
}

/** A string field of the TSR object, decoded; '' when it is null or missing. */
function tsrString(object: string, key: keyof typeof TSR_STRINGS): string {
  const match = object.match(TSR_STRINGS[key]);
  return match ? decodeJsStringLiteral(match[1]!) : '';
}

const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// A meta tag's content with its HTML entities decoded.
function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY, (match, entity: string) => {
    if (entity[0] === '#')
      return String.fromCodePoint(
        entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10),
      );
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function metaContent(html: string, name: string): string {
  const tag = html.match(new RegExp(`<meta[^>]*(?:property|name)="${name}"[^>]*>`))?.[0];
  const content = tag?.match(/content="([^"]*)"/)?.[1];
  return content ? decodeHtmlEntities(content) : '';
}

/**
 * The profile's Relay record: of the page's `Result.Ok` payloads that hold a profile (its
 * `profile_bio`; the timeline's payload has none), the longest, never a merge (a lighter one would
 * empty the website). A payload that doesn't decode or parse is skipped, and one that can't be a
 * profile isn't decoded.
 */
function relayUser(html: string): RelayUser | null {
  let best: { length: number; user: RelayUser } | null = null;
  for (const [, raw] of html.matchAll(RELAY_RESULT)) {
    if (best && raw!.length <= best.length) continue;
    if (!raw!.includes('user_result_by_screen_name') || !raw!.includes('profile_bio')) continue;
    try {
      const json = JSON.parse(decodeJsStringLiteral(raw!)) as {
        data?: { user_result_by_screen_name?: { result?: RelayUser } };
      };
      const user = json.data?.user_result_by_screen_name?.result;
      if (user?.profile_bio) best = { length: raw!.length, user };
    } catch {
      // Another payload may hold it; the TSR fields stand without any.
    }
  }
  return best?.user ?? null;
}

/**
 * What a 200 profile page shows: the TSR object's `profileStatus` says `unavailable`, `found`, or
 * `found` with `isProtected`; a page without it, or with a string that doesn't decode, is `failed`
 * with the reason. A found profile's name, bio, location and avatar come from the TSR object, the
 * bio's t.co links expanded and the website from the Relay record; the meta tags fill a name or bio
 * the TSR object lacks.
 */
export function parseXProfilePage(html: string): XProfilePage {
  try {
    const object = tsrObject(html);
    const profileStatus = object?.match(PROFILE_STATUS)?.[1];
    if (!object || !profileStatus) return { status: 'failed', reason: 'no profile status on the page' };
    if (profileStatus === 'Unavailable') return { status: 'unavailable' };
    if (profileStatus !== 'Available' && profileStatus !== 'ProtectedFromViewer')
      return { status: 'failed', reason: `unknown profile status ${profileStatus}` };

    const user = relayUser(html);
    let bio = tsrString(object, 'description') || metaContent(html, 'twitter:description');
    for (const { url, expanded_url: expanded } of user?.profile_bio?.entities?.description?.urls ?? [])
      if (url && expanded) bio = bio.split(url).join(expanded);
    return {
      status: 'found',
      isProtected: profileStatus === 'ProtectedFromViewer' || user?.privacy?.protected === true,
      name: tsrString(object, 'name') || (metaContent(html, 'og:title').match(OG_TITLE_NAME)?.[1] ?? ''),
      bio,
      location: tsrString(object, 'location'),
      website: user?.profile_bio?.entities?.url?.urls?.[0]?.expanded_url ?? '',
      avatarUrl: tsrString(object, 'avatarUrl') || null,
    };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
}

// The most of a page read: x.com's profile pages are 50–200 KB.
const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 8_000;

/**
 * The public X profile of `handle`, fetched anonymously with the app's own User-Agent: 404 is
 * `notFound`, a 200 page reads as parseXProfilePage says. A redirect (the page moved off x.com),
 * another status, a page past PAGE_MAX_BYTES or a fetch that throws (network, timeout, `signal`) is
 * `failed`, logged once as a warning; a hidden, missing or protected profile is logged at info, so
 * the share of them shows in the logs.
 */
export async function fetchXProfileAsync(
  handle: string,
  { signal, log }: { signal?: AbortSignal; log: Pick<FastifyBaseLogger, 'info' | 'warn'> },
): Promise<XProfilePage> {
  let httpStatus: number | null = null;
  let page: XProfilePage;
  try {
    const response = await fetch(CONTACT_HANDLE_BY_FIELD.xHandle.profileUrl(handle), {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      redirect: 'manual',
      signal: withTimeout(PAGE_TIMEOUT_MS, signal),
    });
    httpStatus = response.status;
    if (response.status !== 200) {
      await response.body?.cancel();
      page =
        response.status === 404
          ? { status: 'notFound' }
          : { status: 'failed', reason: `x.com answered ${response.status}` };
    } else {
      const body = await readCappedBody(response, PAGE_MAX_BYTES);
      page = body
        ? parseXProfilePage(body.toString('utf8'))
        : { status: 'failed', reason: `the page is larger than ${PAGE_MAX_BYTES / 1024 / 1024} MB` };
    }
  } catch (error) {
    page = { status: 'failed', reason: error instanceof Error ? error.message : String(error) };
  }
  if (page.status === 'failed')
    log.warn({ handle, httpStatus, reason: page.reason }, 'From link: x.com gave no readable profile');
  else if (page.status !== 'found')
    log.info({ handle, status: page.status }, 'From link: x.com shows no public profile');
  else if (page.isProtected) log.info({ handle }, 'From link: the profile is protected');
  return page;
}
