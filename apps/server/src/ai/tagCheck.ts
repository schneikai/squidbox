// The tagging check of a vision model (Settings → Assistant → Vision → ⋯ → Run check for an ai_admin,
// or `npm run check:models -- --kind vision`): four fixed photos tagged through the server's own path
// (visionMessages with the Photo tags briefing filled with the mock creator's themes, photoTagsTask:
// fit, dedupe, throw when none fit). It checks only that valid tags come back; what they say is
// judged in Compare.
//
// The photos (checkPhotos/) are four of the mock account's picsum.photos images (Unsplash photos,
// free to use), at the app's vision size: https://picsum.photos/id/<id>/512/341.jpg.
import { readFile } from 'node:fs/promises';
import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import { checkProgress, failedTurn, timedCall } from './checkTurns.js';
import { MOCK_PERSONA } from './mockPersona.js';
import type { CheckRunner } from './modelCheck.js';
import { visionMessages } from './prompts.js';
import { photoTagsTask, runTask } from './tasks.js';

export const PHOTO_FILES = ['10.jpg', '13.jpg', '15.jpg', '19.jpg'];

const SECTION = { id: 'photos', title: 'Photo tags' };
export const TAG_SECTION_IDS = [SECTION.id];

const LIMITS_CHECK = 'within the limits';

/** A check photo as a data URL, as the app sends one. */
export async function photoDataUrl(file: string): Promise<string> {
  const bytes = await readFile(new URL(`./checkPhotos/${file}`, import.meta.url));
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

/**
 * Tags each photo with `model`, briefed with `instructions.visionTagging`. One check per photo:
 * every raw tag kept (non-empty, short enough, no duplicate) and no more than an asset holds. A
 * refusal, a reply that isn't the JSON or any Venice error is that photo's error; the next one runs.
 */
export const checkTaggingModel: CheckRunner = async (model, { instructions, onTurn }) => {
  const progress = checkProgress(onTurn);
  const section = progress.section(SECTION.id, SECTION.title, null);
  for (const file of PHOTO_FILES) {
    const messages = visionMessages({
      prompt: instructions.visionTagging,
      imageDataUrl: await photoDataUrl(file),
      contentTags: MOCK_PERSONA.contentTags,
    });
    let raw: string[] = [];
    const task = {
      ...photoTagsTask,
      check: (reply: { tags: string[] }) => {
        raw = reply.tags;
        return photoTagsTask.check(reply);
      },
    };
    const call = await timedCall(() => runTask({ task, messages, model }));
    if ('error' in call) {
      await progress.add(section, failedTurn({ prompt: file, note: null }, call.error, [LIMITS_CHECK]));
      continue;
    }
    const kept = call.value.tags;
    await progress.add(section, {
      prompt: file,
      note: null,
      seconds: call.seconds,
      unreadable: false,
      reply: null,
      items: kept,
      checks: [
        { name: LIMITS_CHECK, ok: raw.length <= ASSET_TAG_LIMITS.tags && kept.length === raw.length, reason: null },
      ],
      error: null,
    });
  }
  return progress.result();
};
