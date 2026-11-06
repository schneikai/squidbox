// From link on a New contact (POST /contacts/x-profile): the public X profile of a handle, read for
// every account without the assistant (its pass is POST /ai/contact-from-x-profile), with the
// Bluesky profile the bio names.
import type { FastifyBaseLogger } from 'fastify';
import {
  emptyContactRead,
  normalizeHandle,
  OTHER_HANDLE_FIELDS,
  type ContactFromXProfileResponse,
  type XProfileStatus,
} from '@squidbox/shared';
import { fetchAvatarAsync } from './avatarImage.js';
import { fetchBlueskyProfileAsync } from './blueskyProfile.js';
import { handlesInText } from './handlesInText.js';
import { fetchXProfileAsync } from './xProfile.js';

type Log = Pick<FastifyBaseLogger, 'info' | 'warn'>;

// The answer with nothing but the handle: a profile X hides, a missing one, a page not read.
function emptyResponse(status: XProfileStatus, xHandle: string): ContactFromXProfileResponse {
  return { ...emptyContactRead(), status, xHandle, bio: '', website: '', avatar: null };
}

/**
 * What From link fills from the X profile of `handle`: the name, bio, website, location (as the
 * city, as X shows it) and photo X shows, and the Bluesky, OnlyFans and JFF handles the bio and
 * website name (handlesInText). When a Bluesky handle is named, its public profile fills the
 * handles, name and bio still empty, and the photo when X's doesn't download; it is read while X's
 * photo downloads. `xHandle` is always the request's. Never throws for what X gave: the status
 * says it.
 */
export async function readContactFromXProfileAsync({
  handle,
  signal,
  log,
}: {
  handle: string;
  signal?: AbortSignal;
  log: Log;
}): Promise<ContactFromXProfileResponse> {
  const xHandle = normalizeHandle(handle);
  const page = await fetchXProfileAsync(handle, { signal, log });
  if (page.status !== 'found') return emptyResponse(page.status, xHandle);

  const handles = handlesInText([page.bio, page.website]);
  const [bluesky, xAvatar] = await Promise.all([
    handles.blueskyHandle ? fetchBlueskyProfileAsync(handles.blueskyHandle, { signal, log }) : null,
    page.avatarUrl ? fetchAvatarAsync(page.avatarUrl, { signal, log }) : null,
  ]);
  const read = { ...emptyContactRead(), xHandle, name: page.name, city: page.location };
  const more = bluesky ? handlesInText([bluesky.description]) : {};
  for (const field of OTHER_HANDLE_FIELDS) read[field] = handles[field] || more[field] || '';
  if (bluesky) read.name ||= bluesky.displayName;
  const avatar = xAvatar ?? (bluesky?.avatar ? await fetchAvatarAsync(bluesky.avatar, { signal, log }) : null);
  return {
    ...read,
    status: 'found',
    name: read.name.trim(),
    bio: page.bio || (bluesky?.description ?? ''),
    website: page.website,
    avatar,
  };
}
