// What the assistant asks a model for: the JSON shape of the reply and the check it must pass, and
// the one call that runs a task on a model (a compare runs it on several at once).
import { ASSET_TAG_LIMITS, assetTagSchema, uniqueTags, WRITING_TWEET_COUNT } from '@squidbox/shared';
import type { CatalogEntry } from './catalog.js';
import { tagsSchema, tweetsSchema } from './prompts.js';
import { chatJsonAsync, VeniceError, type ChatMessage, type JsonSchemaSpec } from './venice.js';

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
  const kept = uniqueTags(tags);
  if (kept.length === 0) throw new VeniceError('Returned no tags');
  return kept;
}

/**
 * The checked tags that fit the asset's tag schema: those that don't (too long, a NUL character)
 * are dropped, and the list keeps the first ones. Throws when none fit, so nothing the app can't
 * store and push reaches it.
 */
export function fitTags(tags: string[]): string[] {
  const kept = checkTags(tags)
    .filter((tag) => assetTagSchema.safeParse(tag).success)
    .slice(0, ASSET_TAG_LIMITS.tags);
  if (kept.length === 0) throw new VeniceError('The model returned no usable tags');
  return kept;
}

/** What the assistant asks a model for, and the check its reply must pass to be its result. */
export type AiTask<T> = { schema: JsonSchemaSpec<T>; check: (reply: T) => T };

export const writingTask: AiTask<{ tweets: string[] }> = {
  schema: tweetsSchema,
  check: ({ tweets }) => ({ tweets: checkTweets(tweets) }),
};

// A compare's tags: as many as the prompt asked for.
export const visionTask: AiTask<{ tags: string[] }> = {
  schema: tagsSchema,
  check: ({ tags }) => ({ tags: checkTags(tags) }),
};

// A photo's tags to store on its asset (POST /ai/tags): only those that fit the asset.
export const photoTagsTask: AiTask<{ tags: string[] }> = {
  schema: tagsSchema,
  check: ({ tags }) => ({ tags: fitTags(tags) }),
};

/**
 * Asks one model for the task's JSON and returns the reply once it passes the task's check; a failed
 * call or check is a VeniceError that says why. `signal` stops the call.
 */
export async function runTask<T>({
  task,
  messages,
  model,
  signal,
}: {
  task: AiTask<T>;
  messages: ChatMessage[];
  model: CatalogEntry;
  signal?: AbortSignal;
}): Promise<T> {
  const reply = await chatJsonAsync({
    model: model.id,
    messages,
    schema: task.schema,
    supportsResponseSchema: model.model_spec.capabilities.supportsResponseSchema !== false,
    signal,
  });
  return task.check(reply);
}
