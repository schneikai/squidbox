// A blind compare runs the same task on several models at once. Each model's result stands on its
// own: one failing leaves the others' results.
import { WRITING_TWEET_COUNT } from '@squidbox/shared';
import type { CatalogEntry } from './catalog.js';
import { tagsSchema, tweetsSchema } from './prompts.js';
import { chatJsonAsync, VeniceError, type ChatMessage, type JsonSchemaSpec } from './venice.js';

type Logger = { error: (object: unknown, message: string) => void };

/** The trimmed tweets when there are exactly WRITING_TWEET_COUNT non-empty ones; throws otherwise. */
export function checkTweets(tweets: string[]): string[] {
  const kept = tweets.map((tweet) => tweet.trim()).filter(Boolean);
  if (kept.length !== WRITING_TWEET_COUNT) {
    throw new VeniceError(`Returned ${kept.length} tweets instead of ${WRITING_TWEET_COUNT}`);
  }
  return kept;
}

/**
 * The tags trimmed, without empty ones and case-insensitive duplicates, in the model's order, as
 * many as the prompt asked for; throws when none are left.
 */
export function checkTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const kept = tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (kept.length === 0) throw new VeniceError('Returned no tags');
  return kept;
}

/** What a compare asks each model for, and the check its reply must pass to be its result. */
type CompareTask<T> = { schema: JsonSchemaSpec<T>; check: (reply: T) => T };

export const writingTask: CompareTask<{ tweets: string[] }> = {
  schema: tweetsSchema,
  check: ({ tweets }) => ({ tweets: checkTweets(tweets) }),
};

export const visionTask: CompareTask<{ tags: string[] }> = {
  schema: tagsSchema,
  check: ({ tags }) => ({ tags: checkTags(tags) }),
};

/** Sends the same messages to every model at once; each gets its result or its own error. */
export async function compareModels<T>({
  task,
  messages,
  models,
  log,
}: {
  task: CompareTask<T>;
  messages: ChatMessage[];
  models: CatalogEntry[];
  log?: Logger;
}): Promise<((T & { modelId: string }) | { modelId: string; error: string })[]> {
  const settled = await Promise.allSettled(
    models.map(async (model) => {
      const reply = await chatJsonAsync({ model: model.id, messages, schema: task.schema });
      return { modelId: model.id, ...task.check(reply) };
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
