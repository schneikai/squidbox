// A profile photo From link brings: the server downloads it, so the device never contacts X.
import type { FastifyBaseLogger } from 'fastify';
import { IMAGE_MIME_TYPES, type ContactFromXProfileResponse } from '@squidbox/shared';
import { withTimeout } from '../requestSignal.js';
import { readCappedBody } from './readCappedBody.js';
import { USER_AGENT } from './userAgent.js';

const AVATAR_TIMEOUT_MS = 8_000;
// X's 400 px avatars are ~25 KB, Bluesky's thumbnails smaller; the app makes a 512 px photo of it.
const AVATAR_MAX_BYTES = 256 * 1024;
export type AvatarImage = NonNullable<ContactFromXProfileResponse['avatar']>;

const X_AVATAR = 'https://pbs.twimg.com/profile_images/';
const BLUESKY_AVATAR = 'https://cdn.bsky.app/img/avatar/';
const BLUESKY_THUMBNAIL = 'https://cdn.bsky.app/img/avatar_thumbnail/';

/**
 * The URL to download for a profile photo at `url`: an X one as its 400 px size (`_normal` →
 * `_400x400`, the extension kept), a Bluesky one as its thumbnail; null for any other host.
 */
export function avatarDownloadUrl(url: string): string | null {
  if (url.startsWith(X_AVATAR)) return url.replace(/_normal(\.\w+)?$/, '_400x400$1');
  if (url.startsWith(BLUESKY_AVATAR)) return BLUESKY_THUMBNAIL + url.slice(BLUESKY_AVATAR.length);
  if (url.startsWith(BLUESKY_THUMBNAIL)) return url;
  return null;
}

/**
 * The profile photo at `url` (avatarDownloadUrl) as base64 with its media type, or null (logged)
 * when it is on another host, isn't a JPEG, PNG or WebP, is larger than AVATAR_MAX_BYTES or doesn't
 * download.
 */
export async function fetchAvatarAsync(
  url: string,
  { signal, log }: { signal?: AbortSignal; log: Pick<FastifyBaseLogger, 'warn'> },
): Promise<AvatarImage | null> {
  const downloadUrl = avatarDownloadUrl(url);
  if (!downloadUrl) {
    log.warn({ url }, 'From link: a profile photo on an unknown host, not downloaded');
    return null;
  }
  try {
    const response = await fetch(downloadUrl, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'error',
      signal: withTimeout(AVATAR_TIMEOUT_MS, signal),
    });
    if (!response.ok) throw new Error(`answered ${response.status}`);
    const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const known = IMAGE_MIME_TYPES.find((type) => type === mimeType);
    if (!known) {
      await response.body?.cancel();
      throw new Error(`not an image it takes: ${mimeType || 'no content-type'}`);
    }
    const body = await readCappedBody(response, AVATAR_MAX_BYTES);
    if (!body) throw new Error(`larger than ${AVATAR_MAX_BYTES / 1024} KB`);
    return { base64: body.toString('base64'), mimeType: known };
  } catch (error) {
    log.warn({ url: downloadUrl, err: error }, 'From link: the profile photo could not be downloaded');
    return null;
  }
}
