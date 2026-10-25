// A blind compare runs the same task on several models at once. Each model's result stands on its
// own: one failing leaves the others' results.
import { VISION_TAG_COUNT, WRITING_TWEET_COUNT } from '@squidbox/shared';
import type { CatalogEntry } from './catalog.js';
import { tagsSchema, tweetsSchema } from './prompts.js';
import { chatJsonAsync, VeniceError, type ChatMessage, type JsonSchemaSpec } from './venice.js';

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

/** What a compare asks each model for, and how its reply becomes its result. */
type CompareTask<T, R> = { schema: JsonSchemaSpec<T>; toResult: (reply: T) => R };

export const writingTask: CompareTask<{ tweets: string[] }, { tweets: string[] }> = {
  schema: tweetsSchema,
  toResult: ({ tweets }) => ({ tweets: checkTweets(tweets) }),
};

export const visionTask: CompareTask<{ tags: string[] }, { tags: string[] }> = {
  schema: tagsSchema,
  toResult: ({ tags }) => ({ tags: checkTags(tags) }),
};

/** Sends the same messages to every model at once; each gets its result or its own error. */
export async function compareModels<T, R>({
  task,
  messages,
  models,
  log,
}: {
  task: CompareTask<T, R>;
  messages: ChatMessage[];
  models: CatalogEntry[];
  log?: Logger;
}): Promise<((R & { modelId: string }) | { modelId: string; error: string })[]> {
  const settled = await Promise.allSettled(
    models.map(async (model) => {
      const reply = await chatJsonAsync({ model: model.id, messages, schema: task.schema });
      return { modelId: model.id, ...task.toResult(reply) };
    }),
  );
  return settled.map((result, index) => {
    const modelId = models[index]!.id;
    if (result.status === 'fulfilled') return result.value;
    if (result.reason instanceof VeniceError) return { modelId, error: result.reason.message };
    log?.error({ err: result.reason, modelId }, 'AI compare failed');
    return { modelId, error: 'Something went wrong' };
  });
}
