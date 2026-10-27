// The assistant chat (POST /ai/chat): the user's writing model answers the transcript as the
// creator's collaborator, with post options only when asked, briefed by the chat briefing filled with
// their persona, Favorites and the chat's post.
import type { ChatReply, ChatRequest } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { readFavorites, readPersona } from './persona.js';
import { chatMessages } from './prompts.js';
import { chatTask, runChosenModelTask } from './tasks.js';

/** The user's writing model's reply to the chat's last turn (runChosenModelTask's errors). */
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
}): Promise<ChatReply> {
  async function messagesAsync() {
    const [persona, favorites, instructions] = await Promise.all([
      readPersona(db, user.id),
      readFavorites(db, user.id),
      readInstructions(db, user),
    ]);
    return chatMessages({ context: request.context, transcript: request.messages, persona, favorites, instructions });
  }
  return runChosenModelTask({
    db,
    userId: user.id,
    kind: 'writing',
    task: chatTask,
    messagesAsync: messagesAsync(),
    signal,
  });
}
