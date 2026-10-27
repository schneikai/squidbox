// The assistant chat (POST /ai/chat): the user's writing model answers the transcript with posts, as
// the user (writing instructions, persona, Favorites) and about the chat's post (the chat context).
import type { ChatRequest } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { AppError } from '../errors.js';
import { catalogAsync, findModel } from './catalog.js';
import { readInstructions } from './instructions.js';
import { readChosenModelId } from './modelChoices.js';
import { readFavorites, readPersona } from './persona.js';
import { chatMessages } from './prompts.js';
import { runTask, writingTask } from './tasks.js';
import { VeniceError } from './venice.js';

/**
 * The posts the user's writing model writes for the chat's last turn. 502 ai_unavailable when the
 * model is gone or Venice fails; anything else is the error handler's 500. `signal` stops the call.
 */
export async function chatAsync({
  db,
  user,
  request,
  signal,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  request: ChatRequest;
  signal?: AbortSignal;
}): Promise<string[]> {
  const [persona, favorites, instructions, modelId, catalog] = await Promise.all([
    readPersona(db, user.id),
    readFavorites(db, user.id),
    readInstructions(db, user),
    readChosenModelId(db, user.id, 'writing'),
    catalogAsync(),
  ]);
  const found = findModel(catalog.entries, modelId, 'writing');
  if ('error' in found) throw AppError.aiUnavailable(`Your writing model: ${found.error}`);
  const messages = chatMessages({
    context: request.context,
    transcript: request.messages,
    persona,
    favorites,
    instructions,
  });
  try {
    const { tweets } = await runTask({ task: writingTask, messages, model: found.entry, signal });
    return tweets;
  } catch (error) {
    if (error instanceof VeniceError) throw AppError.aiUnavailable(error.message);
    throw error;
  }
}
