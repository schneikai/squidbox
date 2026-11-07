// From link on a New contact (POST /contacts/x-profile): the public X profile of a handle, as the
// page shows it. The assistant then reads the handles and the place from it (POST
// /ai/contact-from-x-profile).
import type { FastifyBaseLogger } from 'fastify';
import { normalizeHandle, type ContactFromXProfileResponse, type XProfileStatus } from '@squidbox/shared';
import { withTimeout } from '../withTimeout.js';
import { fetchAvatarAsync } from './avatarImage.js';
import { fetchXProfileAsync } from './fetchXProfileAsync.js';

type Log = Pick<FastifyBaseLogger, 'info' | 'warn'>;

// The most the whole read may take, its steps together (each has its own timeout too); the app waits
// longer (readXProfileAsync). What a step past it didn't bring stays empty.
const X_PROFILE_READ_BUDGET_MS = 12_000;

// The answer with nothing but the handle: a profile X hides, a missing one, a page not read.
function emptyResponse(status: XProfileStatus, xHandle: string): ContactFromXProfileResponse {
  return { status, xHandle, name: '', location: '', bio: '', website: '', avatar: null };
}

/**
 * What the X profile of `handle` shows: the name, location, bio, website and photo, all within
 * X_PROFILE_READ_BUDGET_MS. `xHandle` is always the request's. Never throws for what X gave: the
 * status says it.
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
  const budget = withTimeout(X_PROFILE_READ_BUDGET_MS, signal);
  const xHandle = normalizeHandle(handle);
  const page = await fetchXProfileAsync(handle, { signal: budget, log });
  if (page.status !== 'found') return emptyResponse(page.status, xHandle);

  const avatar = page.avatarUrl ? await fetchAvatarAsync(page.avatarUrl, { signal: budget, log }) : null;
  return {
    status: 'found',
    xHandle,
    name: page.name.trim(),
    location: page.location,
    bio: page.bio,
    website: page.website,
    avatar,
  };
}
