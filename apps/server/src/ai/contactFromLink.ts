// From link on a New contact (POST /ai/contact-from-link): the server reads the public X profile of
// a handle, the user's writing model reads the contact's fields in it as their From link
// instructions say, and the server downloads the profile photo. Only X links for now.
import type { FastifyBaseLogger } from 'fastify';
import {
  CONTACT_HANDLE_FIELDS,
  emptyContactRead,
  normalizeHandle,
  type ContactFromLinkResponse,
  type ContactRead,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { fetchAvatarAsync } from '../contacts/avatarImage.js';
import { fetchXProfileAsync } from '../contacts/fetchXProfileAsync.js';
import { withTimeout } from '../withTimeout.js';
import { readInstructions } from './instructions.js';
import { xProfileMessages, type XProfileText } from './prompts.js';
import { contactReadTask, runChosenModelTask } from './tasks.js';

// The most the page and the photo may take together (each has its own timeout too); the model's
// read has its own (runChosenModelTask).
const X_PROFILE_READ_BUDGET_MS = 12_000;

/**
 * The model's read with the X handle the link's, and each other handle only when the profile's text
 * names it, so one the model made up fills nothing.
 */
function checkedRead(read: ContactRead, profile: XProfileText): ContactRead {
  const text = `${profile.name}\n${profile.bio}\n${profile.website}`.toLowerCase();
  const handles = Object.fromEntries(
    CONTACT_HANDLE_FIELDS.map((field) => [
      field,
      read[field] && text.includes(read[field].toLowerCase()) ? read[field] : '',
    ]),
  );
  return { ...read, ...handles, xHandle: profile.handle };
}

/**
 * What From link fills for `handle`: the profile's status, the contact the model read in it (nothing
 * but the X handle unless `found`) and its photo (null when it doesn't download). 502 ai_unavailable
 * when the model's read fails (runChosenModelTask). `signal` stops it all.
 */
export async function readContactFromLinkAsync({
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
  log: Pick<FastifyBaseLogger, 'info' | 'warn'>;
}): Promise<ContactFromLinkResponse> {
  const xHandle = normalizeHandle(handle);
  const budget = withTimeout(X_PROFILE_READ_BUDGET_MS, signal);
  const page = await fetchXProfileAsync(handle, { signal: budget, log });
  if (page.status !== 'found')
    return { status: page.status, contact: { ...emptyContactRead(), xHandle }, avatar: null };

  const profile: XProfileText = {
    handle: xHandle,
    name: page.name.trim(),
    bio: page.bio,
    location: page.location,
    website: page.website,
  };
  const [read, avatar] = await Promise.all([
    runChosenModelTask({
      db,
      user,
      kind: 'writing',
      task: contactReadTask,
      messagesAsync: readInstructions(db, user).then((instructions) =>
        xProfileMessages(instructions.contactXProfile, profile),
      ),
      signal,
    }),
    page.avatarUrl ? fetchAvatarAsync(page.avatarUrl, { signal: budget, log }) : null,
  ]);
  return { status: 'found', contact: checkedRead(read, profile), avatar };
}
