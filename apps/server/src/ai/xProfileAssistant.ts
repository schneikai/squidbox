// From link's assistant pass (POST /ai/contact-from-x-profile): the user's writing model reads the
// X profile the app got from POST /contacts/x-profile, as their From link instructions say.
import type { ContactFromXProfileAiRequest, ContactFromXProfileAiResponse } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { xProfileMessages } from './prompts.js';
import { contactReadTask, runChosenModelTask } from './tasks.js';

/**
 * The Bluesky, OnlyFans and JFF handles the profile's fields name, and its location split into its
 * city, state and country, each empty when the profile doesn't show it. 502 ai_unavailable when the
 * model is gone, Venice fails or the reply isn't the JSON (runChosenModelTask). `signal` stops the
 * Venice call.
 */
export async function readXProfileWithAssistantAsync({
  db,
  user,
  profile,
  signal,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  profile: ContactFromXProfileAiRequest;
  signal?: AbortSignal;
}): Promise<ContactFromXProfileAiResponse> {
  return runChosenModelTask({
    db,
    user,
    kind: 'writing',
    task: contactReadTask,
    messagesAsync: readInstructions(db, user).then((instructions) =>
      xProfileMessages(instructions.contactXProfile, profile),
    ),
    signal,
  });
}
