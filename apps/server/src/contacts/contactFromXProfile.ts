// From link on a New contact (POST /contacts/x-profile): the public X profile of a handle, read for
// every account, with the assistant's pass for accounts with the `ai` feature and the Bluesky
// profile the bio names.
import type { FastifyBaseLogger } from 'fastify';
import {
  CONTACT_HANDLE_FIELDS,
  normalizeHandle,
  type ContactFromXProfileResponse,
  type ContactRead,
  type XProfileStatus,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from '../ai/instructions.js';
import { xProfileMessages } from '../ai/prompts.js';
import { contactReadTask, runChosenModelTask } from '../ai/tasks.js';
import { isAiConfigured } from '../ai/venice.js';
import { fetchAvatarAsync } from './avatarImage.js';
import { fetchBlueskyProfileAsync } from './blueskyProfile.js';
import { handlesInText } from './handlesInText.js';
import { fetchXProfileAsync } from './xProfile.js';

type Log = Pick<FastifyBaseLogger, 'info' | 'warn'>;

// The answer with nothing but the handle: a profile X hides, a missing one, a page not read.
function emptyResponse(status: XProfileStatus, xHandle: string): ContactFromXProfileResponse {
  return {
    status,
    name: '',
    ...(Object.fromEntries(CONTACT_HANDLE_FIELDS.map((field) => [field, ''])) as Record<
      (typeof CONTACT_HANDLE_FIELDS)[number],
      string
    >),
    xHandle,
    city: '',
    state: '',
    country: '',
    bio: '',
    website: '',
    avatar: null,
  };
}

/**
 * What From link fills from the X profile of `handle`: the name, bio, website, place and photo X
 * shows, the Bluesky, OnlyFans and JFF handles the bio and links name (handlesInText), and, for an
 * `ai` account on a server with Venice, the handles those miss and the place split by the user's
 * writing model (instructions.contactXProfile); without it the location is the city as X shows it.
 * A failed assistant pass is logged and the rest stands. When a Bluesky handle is known, its public
 * profile fills the handles, name, bio and photo still empty. `xHandle` is always the request's.
 * Never throws for what X gave: the status says it.
 */
export async function readContactFromXProfileAsync({
  db,
  user,
  handle,
  signal,
  log,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  handle: string;
  signal?: AbortSignal;
  log: Log;
}): Promise<ContactFromXProfileResponse> {
  const xHandle = normalizeHandle(handle);
  const page = await fetchXProfileAsync(handle, { signal, log });
  if (page.status !== 'found') return emptyResponse(page.status, xHandle);

  let { name, bio, avatarUrl } = page;
  const read: Omit<ContactRead, 'name' | 'xHandle'> = {
    blueskyHandle: '',
    onlyFansHandle: '',
    jffHandle: '',
    city: page.location,
    state: '',
    country: '',
    ...handlesInText([page.bio, page.website, ...page.links]),
  };

  if (user.features.includes('ai') && isAiConfigured()) {
    try {
      const assistant = await runChosenModelTask({
        db,
        user,
        kind: 'writing',
        task: contactReadTask,
        messagesAsync: readInstructions(db, user).then((instructions) =>
          xProfileMessages(instructions.contactXProfile, { handle: xHandle, ...page }),
        ),
        signal,
      });
      for (const field of ['blueskyHandle', 'onlyFansHandle', 'jffHandle'] as const) read[field] ||= assistant[field];
      // The place as the model split it; as X shows it when the model found none in it.
      if (assistant.city || assistant.state || assistant.country)
        Object.assign(read, { city: assistant.city, state: assistant.state, country: assistant.country });
    } catch (error) {
      log.warn({ err: error, handle }, 'From link: the assistant pass failed, filling without it');
    }
  }

  if (read.blueskyHandle) {
    const bluesky = await fetchBlueskyProfileAsync(read.blueskyHandle, { signal, log });
    if (bluesky) {
      const more = handlesInText([bluesky.description]);
      read.onlyFansHandle ||= more.onlyFansHandle ?? '';
      read.jffHandle ||= more.jffHandle ?? '';
      name ||= bluesky.displayName;
      bio ||= bluesky.description;
      avatarUrl ??= bluesky.avatar;
    }
  }

  const avatar = avatarUrl ? await fetchAvatarAsync(avatarUrl, { signal, log }) : null;
  return { status: 'found', ...read, xHandle, name: name.trim(), bio, website: page.website, avatar };
}
