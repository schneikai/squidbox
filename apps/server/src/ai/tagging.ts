// Tagging one photo for the app to store on its asset (POST /ai/tags): the user's Photo tags
// instructions and content themes, their chosen vision model or the default one.
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { readPersona } from './persona.js';
import { visionMessages } from './prompts.js';
import { photoTagsTask, runChosenModelTask } from './tasks.js';

/**
 * The tags the user's vision model sees in the photo, as many as fit the asset. 502 ai_unavailable
 * when the model is gone or can't see photos, when Venice fails, or when no tag fits
 * (runChosenModelTask). `signal` stops the Venice call.
 */
export async function tagPhotoAsync({
  db,
  user,
  image,
  signal,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  image: { base64: string; mimeType: string };
  signal?: AbortSignal;
}): Promise<string[]> {
  async function messagesAsync() {
    const [persona, instructions] = await Promise.all([readPersona(db, user.id), readInstructions(db, user)]);
    return visionMessages({
      prompt: instructions.visionTagging,
      imageDataUrl: `data:${image.mimeType};base64,${image.base64}`,
      contentTags: persona?.contentTags ?? [],
    });
  }
  const { tags } = await runChosenModelTask({
    db,
    user,
    kind: 'vision',
    task: photoTagsTask,
    messagesAsync: messagesAsync(),
    signal,
  });
  return tags;
}
