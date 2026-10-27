// The assistant chat (POST /ai/chat): the user's writing model answers the transcript with posts, as
// the user (writing instructions, persona, Favorites) and about the chat's post (the chat context).
import type { ChatRequest } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { readFavorites, readPersona } from './persona.js';
import { chatMessages } from './prompts.js';
import { runChosenModelTask, writingTask } from './tasks.js';

/** The posts the user's writing model writes for the chat's last turn (runChosenModelTask's errors). */
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
  async function messagesAsync() {
    const [persona, favorites, instructions] = await Promise.all([
      readPersona(db, user.id),
      readFavorites(db, user.id),
      readInstructions(db, user),
    ]);
    return chatMessages({ context: request.context, transcript: request.messages, persona, favorites, instructions });
  }
  const { tweets } = await runChosenModelTask({
    db,
    userId: user.id,
    kind: 'writing',
    task: writingTask,
    messagesAsync: messagesAsync(),
    signal,
  });
  return tweets;
}
