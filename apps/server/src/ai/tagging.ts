// Tagging for the app to store on its assets: one photo (POST /ai/tags, the user's Photo tags
// instructions) or a sample of an album's photos in one request (POST /ai/album-tags, their Album
// tags instructions), each filled with their content themes, on their chosen vision model or the
// default one.
import { imageDataUrl, type InstructionKind } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { readInstructions } from './instructions.js';
import { readPersona } from './persona.js';
import { visionMessages } from './prompts.js';
import { photoTagsTask, runChosenModelTask } from './tasks.js';

type Image = { base64: string; mimeType: string };

type TagOptions = {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  signal?: AbortSignal;
};

/**
 * The tags the user's vision model sees in the photo, as many as fit the asset. 502 ai_unavailable
 * when the model is gone or can't see photos, when Venice fails, or when no tag fits
 * (runChosenModelTask). `signal` stops the Venice call.
 */
export function tagPhotoAsync({ image, ...options }: TagOptions & { image: Image }): Promise<string[]> {
  return tagImagesAsync({ ...options, kind: 'visionTagging', images: [image] });
}

/**
 * The tags the user's vision model finds fit all of an album's photos, from a sample of them in one
 * request, as many as fit an asset. Fails as tagPhotoAsync does.
 */
export function tagAlbumAsync({ images, ...options }: TagOptions & { images: Image[] }): Promise<string[]> {
  return tagImagesAsync({ ...options, kind: 'albumTagging', images });
}

// The images in one request, briefed by the instruction `kind` filled with the user's themes.
async function tagImagesAsync({
  db,
  user,
  kind,
  images,
  signal,
}: TagOptions & { kind: Extract<InstructionKind, 'visionTagging' | 'albumTagging'>; images: Image[] }): Promise<
  string[]
> {
  async function messagesAsync() {
    const [persona, instructions] = await Promise.all([readPersona(db, user.id), readInstructions(db, user)]);
    return visionMessages({
      prompt: instructions[kind],
      imageDataUrls: images.map((image) => imageDataUrl(image)),
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
