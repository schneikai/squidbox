// Reading a public X profile page (From link on a New contact): an anonymous GET of x.com/<handle>,
// parsed without running anything. The page holds the profile twice: TanStack Router's TSR object
// (name, bio with t.co links, location, avatar, profile status), which every variant of the page
// has, and Relay's `UserByScreenName` JSON (the t.co links expanded, the website), which the full
// page has. The HTML is never stored or logged.
import type { FastifyBaseLogger } from 'fastify';
import type { XProfileStatus } from '@squidbox/shared';
import { withTimeout } from '../requestSignal.js';
import { decodeJsStringLiteral } from './jsStringLiteral.js';
import { readCappedBody } from './readCappedBody.js';
import { USER_AGENT } from './userAgent.js';

/** What a profile page showed. A field that isn't there is '' (null for the avatar). */
export type XProfilePage = {
  status: XProfileStatus;
  // Why a `failed` page failed, in words (never the HTML).
  reason?: string;
  isProtected: boolean;
  name: string;
  bio: string;
  location: string;
  website: string;
  avatarUrl: string | null;
  // Every link the profile expands (the website first), without repeats.
  links: string[];
};

const EMPTY_PAGE: Omit<XProfilePage, 'status'> = {
  isProtected: false,
  name: '',
  bio: '',
  location: '',
  website: '',
  avatarUrl: null,
  links: [],
};

// The body of a JS or JSON string literal: up to its first unescaped quote.
const STRING_BODY = String.raw`((?:[^"\\]|\\[\s\S])*)`;
const PROFILE_STATUS = /[{,]profileStatus:"([A-Za-z]+)"/;
const RELAY_RESULT = new RegExp(String.raw`kind:"Result\.Ok",value:"${STRING_BODY}"`, 'g');

// The profile's Relay record, as far as it is read.
type RelayUser = {
  core?: { name?: string; screen_name?: string };
  profile_bio?: {
    description?: string;
    entities?: {
      description?: { urls?: { url?: string; expanded_url?: string }[] };
      url?: { urls?: { expanded_url?: string }[] };
    };
  };
  location?: { location?: string };
  privacy?: { protected?: boolean };
};

/**
 * The flat part of the TSR object that holds `profileStatus` (`l:$R[n]={…}` up to its first nested
 * `$R[`), or null when the page has none.
 */
function tsrObject(html: string): string | null {
  const status = html.search(/[{,]profileStatus:"/);
  if (status === -1) return null;
  const start = html.lastIndexOf('l:$R[', status);
  if (start === -1) return null;
  const open = html.indexOf('{', start);
  const nested = html.indexOf('$R[', open);
  return html.slice(open, nested === -1 || nested < status ? undefined : nested);
}

/** A string field of the TSR object, decoded; '' when it is null or missing. */
function tsrString(object: string, key: string): string {
  const match = object.match(new RegExp(String.raw`[{,]${key}:"${STRING_BODY}"`));
  return match ? decodeJsStringLiteral(match[1]!) : '';
}

const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// A meta tag's content with its HTML entities decoded.
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
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
 * empty the website). A payload that doesn't decode or parse is skipped.
 */
function relayUser(html: string): RelayUser | null {
  let best: { length: number; user: RelayUser } | null = null;
  for (const [, raw] of html.matchAll(RELAY_RESULT)) {
    if (best && raw!.length <= best.length) continue;
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
 * What an X profile page shows (`httpStatus` is its response's): 404 is `notFound` without reading
 * the page; else the TSR object's `profileStatus` says `unavailable` (hidden from signed-out readers),
 * `found`, or `found` with `isProtected`; a page without it, or with a string that doesn't decode, is
 * `failed` with the reason. A found profile's name, bio, location and avatar come from the TSR object,
 * the bio's t.co links expanded and the website from the Relay record; the meta tags fill a name or
 * bio the TSR object lacks.
 */
export function parseXProfilePage(html: string, httpStatus: number): XProfilePage {
  if (httpStatus === 404) return { status: 'notFound', ...EMPTY_PAGE };
  try {
    const object = tsrObject(html);
    const profileStatus = object?.match(PROFILE_STATUS)?.[1];
    if (!object || !profileStatus) return { status: 'failed', reason: 'no profile status on the page', ...EMPTY_PAGE };
    if (profileStatus === 'Unavailable') return { status: 'unavailable', ...EMPTY_PAGE };
    if (profileStatus !== 'Available' && profileStatus !== 'ProtectedFromViewer')
      return { status: 'failed', reason: `unknown profile status ${profileStatus}`, ...EMPTY_PAGE };

    const user = relayUser(html);
    const bioUrls = user?.profile_bio?.entities?.description?.urls ?? [];
    const website = user?.profile_bio?.entities?.url?.urls?.[0]?.expanded_url ?? '';
    let bio = tsrString(object, 'description') || metaContent(html, 'twitter:description');
    for (const { url, expanded_url: expanded } of bioUrls) if (url && expanded) bio = bio.split(url).join(expanded);
    const ogTitle = metaContent(html, 'og:title').match(/^(.*) \(@\w+\) on X$/)?.[1] ?? '';
    const links = [
      ...new Set([website, ...bioUrls.map(({ expanded_url: expanded }) => expanded ?? '')].filter(Boolean)),
    ];
    return {
      status: 'found',
      isProtected: profileStatus === 'ProtectedFromViewer' || user?.privacy?.protected === true,
      name: tsrString(object, 'name') || ogTitle,
      bio,
      location: tsrString(object, 'location'),
      website,
      avatarUrl: tsrString(object, 'avatarUrl') || null,
      links,
    };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : String(error), ...EMPTY_PAGE };
  }
}

// The most of a page read: x.com's profile pages are 50–200 KB.
const PAGE_MAX_BYTES = 3 * 1024 * 1024;
const PAGE_TIMEOUT_MS = 8_000;

/**
 * The public X profile of `handle` (parseXProfilePage), fetched anonymously with the app's own
 * User-Agent. A redirect (the page moved off x.com), a status other than 200 or 404, a page past 3 MB
 * or a fetch that throws (network, timeout, `signal`) is `failed`, logged once as a warning; a hidden,
 * missing or protected profile is logged at info, so the share of them shows in the logs.
 */
export async function fetchXProfileAsync(
  handle: string,
  { signal, log }: { signal?: AbortSignal; log: Pick<FastifyBaseLogger, 'info' | 'warn'> },
): Promise<XProfilePage> {
  let httpStatus: number | null = null;
  let page: XProfilePage;
  try {
    const response = await fetch(`https://x.com/${handle}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      redirect: 'manual',
      signal: withTimeout(PAGE_TIMEOUT_MS, signal),
    });
    httpStatus = response.status;
    if (response.status === 404) page = parseXProfilePage('', 404);
    else if (response.status !== 200) {
      await response.body?.cancel();
      page = { status: 'failed', reason: `x.com answered ${response.status}`, ...EMPTY_PAGE };
    } else {
      const body = await readCappedBody(response, PAGE_MAX_BYTES);
      page = body
        ? parseXProfilePage(body.toString('utf8'), 200)
        : { status: 'failed', reason: 'the page is larger than 3 MB', ...EMPTY_PAGE };
    }
  } catch (error) {
    page = { status: 'failed', reason: error instanceof Error ? error.message : String(error), ...EMPTY_PAGE };
  }
  if (page.status === 'failed')
    log.warn({ handle, httpStatus, reason: page.reason }, 'From link: x.com gave no readable profile');
  else if (page.status !== 'found')
    log.info({ handle, status: page.status }, 'From link: x.com shows no public profile');
  else if (page.isProtected) log.info({ handle }, 'From link: the profile is protected');
  return page;
}
