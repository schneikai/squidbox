// A blind compare runs the same task on several models at once. Each model's result stands on its
// own: one failing leaves the others' results.
import { VISION_TAG_COUNT, WRITING_TWEET_COUNT, type VisionResult, type WritingResult } from '@squidbox/shared';
import { reasoningEffortFor, type CatalogEntry, type VeniceAccess } from './catalog.js';
import { tagsSchema, tweetsSchema, visionMessages, writingMessages, type Persona } from './prompts.js';
import { chatJsonAsync, VeniceError } from './venice.js';

const WRITING_MAX_TOKENS = 600;
const VISION_MAX_TOKENS = 200;

type Logger = { error: (object: unknown, message: string) => void };

/** Trimmed, without empty ones and case-insensitive duplicates, in the model's order. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** The trimmed tweets when there are exactly WRITING_TWEET_COUNT non-empty ones; throws otherwise. */
export function checkTweets(tweets: string[]): string[] {
  const kept = tweets.map((tweet) => tweet.trim()).filter(Boolean);
  if (kept.length !== WRITING_TWEET_COUNT) {
    throw new VeniceError(`Returned ${kept.length} tweets instead of ${WRITING_TWEET_COUNT}`);
  }
  return kept;
}

/** The normalized tags when exactly VISION_TAG_COUNT remain; throws otherwise. */
export function checkTags(tags: string[]): string[] {
  const kept = normalizeTags(tags);
  if (kept.length !== VISION_TAG_COUNT) {
    throw new VeniceError(`Returned ${kept.length} tags instead of ${VISION_TAG_COUNT}`);
  }
  return kept;
}

async function settle<T extends { modelId: string }>(
  models: CatalogEntry[],
  run: (model: CatalogEntry) => Promise<T>,
  log?: Logger,
): Promise<(T | { modelId: string; error: string })[]> {
  const settled = await Promise.allSettled(models.map(run));
  return settled.map((result, index) => {
    const modelId = models[index]!.id;
    if (result.status === 'fulfilled') return result.value;
    if (result.reason instanceof VeniceError) return { modelId, error: result.reason.message };
    log?.error({ err: result.reason, modelId }, 'AI compare failed');
    return { modelId, error: 'Something went wrong' };
  });
}

export function compareWriting({
  baseUrl,
  apiKey,
  prompt,
  persona = null,
  models,
  log,
}: VeniceAccess & { prompt: string; persona?: Persona; models: CatalogEntry[]; log?: Logger }): Promise<
  WritingResult[]
> {
  const messages = writingMessages({ prompt, persona });
  return settle(
    models,
    async (model) => {
      const { tweets } = await chatJsonAsync({
        baseUrl,
        apiKey,
        model: model.id,
        reasoningEffort: reasoningEffortFor(model),
        maxTokens: WRITING_MAX_TOKENS,
        messages,
        schema: tweetsSchema,
      });
      return { modelId: model.id, tweets: checkTweets(tweets) };
    },
    log,
  );
}

export function compareVision({
  baseUrl,
  apiKey,
  imageDataUrl,
  models,
  log,
}: VeniceAccess & { imageDataUrl: string; models: CatalogEntry[]; log?: Logger }): Promise<VisionResult[]> {
  const messages = visionMessages({ imageDataUrl });
  return settle(
    models,
    async (model) => {
      const { tags } = await chatJsonAsync({
        baseUrl,
        apiKey,
        model: model.id,
        reasoningEffort: reasoningEffortFor(model),
        maxTokens: VISION_MAX_TOKENS,
        messages,
        schema: tagsSchema,
      });
      return { modelId: model.id, tags: checkTags(tags) };
    },
    log,
  );
}
