// The vision Verify of a model (Settings → Assistant → Vision → the model → Verify for an ai_admin,
// or `npm run verify:models -- --kind vision`): four fixed photos tagged through the server's own
// path (visionMessages with the Photo tags briefing filled with the mock creator's themes,
// photoTagsTask: fit, dedupe, throw when none fit). It checks only that valid tags come back; what
// they say is judged in Compare.
//
// The photos (verifyPhotos/) are four of the mock account's picsum.photos images (Unsplash photos,
// free to use), at the app's vision size: https://picsum.photos/id/<id>/512/341.jpg.
import { readFile } from 'node:fs/promises';
import { ASSET_TAG_LIMITS } from '@squidbox/shared';
import type { VerifyPlan } from '@squidbox/shared';
import { MOCK_PERSONA } from './mockPersona.js';
import { visionMessages } from './prompts.js';
import { photoTagsTask, runTask } from './tasks.js';
import type { VerifyRunner } from './verify.js';
import { missedTurn, timedCall, verifyProgress } from './verifyTurns.js';

export const PHOTO_FILES = ['10.jpg', '13.jpg', '15.jpg', '19.jpg'];

const SECTION = { id: 'photos', title: 'Photo tags' };

/** What a vision Verify will do: one section with the photos. */
export const TAG_PLAN: VerifyPlan = { sections: [{ ...SECTION, prompts: PHOTO_FILES }] };

const LIMITS_CHECK = 'within the limits';

// The limits check of a photo's tags, `raw` as the model answered them and `kept` after fitting.
function limitsCheck(raw: string[], kept: string[]) {
  const tooMany = raw.length > ASSET_TAG_LIMITS.tags;
  const ok = !tooMany && kept.length === raw.length;
  const reason = tooMany
    ? `${raw.length} tags, over the limit of ${ASSET_TAG_LIMITS.tags}`
    : `a tag over ${ASSET_TAG_LIMITS.tag} characters or a duplicate`;
  return { name: LIMITS_CHECK, ok, reason: ok ? null : reason };
}

/** A Verify photo as a data URL, as the app sends one. */
export async function photoDataUrl(file: string): Promise<string> {
  const bytes = await readFile(new URL(`./verifyPhotos/${file}`, import.meta.url));
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

/**
 * Tags each photo with `model`, briefed with `instructions.visionTagging`. One check per photo:
 * every raw tag kept (non-empty, short enough, no duplicate) and no more than an asset holds. A
 * refusal, a reply that isn't the JSON or no usable tags is that photo's miss; the next one runs.
 * Venice not answering stops the run (VerifyStopped).
 */
export const verifyTaggingModel: VerifyRunner = async (model, { instructions, onTurn }) => {
  const progress = verifyProgress(onTurn);
  const section = progress.section(SECTION.id, SECTION.title, null, null);
  return progress.untilStopped(async () => {
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
        await progress.add(section, missedTurn({ prompt: file, note: null }, call.error, [LIMITS_CHECK]));
        continue;
      }
      await progress.add(section, {
        prompt: file,
        note: null,
        seconds: call.seconds,
        unreadable: false,
        reply: null,
        items: call.value.tags,
        checks: [limitsCheck(raw, call.value.tags)],
        error: null,
      });
    }
  });
};
