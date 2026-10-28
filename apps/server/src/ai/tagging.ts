// Tagging one photo for the app to store on its asset (POST /ai/tags): the user's Photo tags
// instructions and content themes, their chosen vision model or the default one.
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { AppError } from '../errors.js';
import { catalogAsync, findModel } from './catalog.js';
import { readInstructions } from './instructions.js';
import { readChosenModelId } from './modelChoices.js';
import { readPersona } from './persona.js';
import { visionMessages } from './prompts.js';
import { photoTagsTask, runTask } from './tasks.js';
import { VeniceError } from './venice.js';

/**
 * The tags the user's vision model sees in the photo, as many as fit the asset. 502 ai_unavailable
 * when the model is gone or can't see photos, when Venice fails, or when no tag fits; anything else
 * is the error handler's 500. `signal` stops the Venice call.
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
  const [persona, instructions, modelId, catalog] = await Promise.all([
    readPersona(db, user.id),
    readInstructions(db, user),
    readChosenModelId(db, user.id, 'vision'),
    catalogAsync(),
  ]);
  const found = findModel(catalog.entries, modelId, 'vision');
  if ('error' in found) throw AppError.aiUnavailable(`Your vision model: ${found.error}`);
  const messages = visionMessages({
    prompt: instructions.visionTagging,
    imageDataUrl: `data:${image.mimeType};base64,${image.base64}`,
    instructions,
    contentTags: persona?.contentTags ?? [],
  });
  try {
    const { tags } = await runTask({ task: photoTagsTask, messages, model: found.entry, signal });
    return tags;
  } catch (error) {
    if (error instanceof VeniceError) throw AppError.aiUnavailable(error.message);
    throw error;
  }
}
