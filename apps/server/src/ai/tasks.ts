// What the assistant asks a model for: the JSON shape of the reply and the check it must pass, and
// the one call that runs a task on a model (a compare runs it on several at once).
import {
  ASSET_TAG_LIMITS,
  assetTagSchema,
  CHAT_LIMITS,
  uniqueTags,
  WRITING_TWEET_COUNT,
  type AiModelKind,
  type ChatReply,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { AppError } from '../errors.js';
import { catalogAsync, findModel, type CatalogEntry } from './catalog.js';
import { readChosenModelId } from './modelChoices.js';
import { chatReplyJsonSpec, tagsSchema, tweetsSchema } from './prompts.js';
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
 * A chat reply trimmed to chatReplySchema, so the app can send it back: the reply and each post option
 * cut to CHAT_LIMITS.message, the non-empty options, the first CHAT_LIMITS.posts of them; throws when
 * neither is left (a useless reply, so Retry shows).
 */
export function checkChatReply({ reply, postOptions }: ChatReply): ChatReply {
  const kept = {
    reply: reply.trim().slice(0, CHAT_LIMITS.message),
    postOptions: postOptions
      .map((option) => option.trim().slice(0, CHAT_LIMITS.message))
      .filter(Boolean)
      .slice(0, CHAT_LIMITS.posts),
  };
  if (!kept.reply && kept.postOptions.length === 0) throw new VeniceError('Returned neither a reply nor posts');
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

/**
 * What the assistant asks a model for, and the check its reply must pass to be its result.
 * `quickReply`: the task wants a fast answer over a thought-through one, so the model's reasoning is
 * turned down (reasoningEffort); a task without it runs on the model's defaults. `onUnreadable`: what
 * a reply that isn't the schema's JSON becomes (its text), instead of failing.
 */
export type AiTask<T> = {
  schema: JsonSchemaSpec<T>;
  check: (reply: T) => T;
  quickReply?: true;
  onUnreadable?: (content: string) => T;
};

// Reasoning efforts from the least to the most, as Venice names them.
const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/**
 * The effort that turns a model's reasoning down: the lowest above 'none' it lists ('low' when it
 * lists none) for a model whose effort can be set; 'none' for one that only reasons (Venice then skips
 * its thinking); undefined for a model that doesn't reason.
 */
export function reasoningEffort(entry: CatalogEntry): string | undefined {
  const { supportsReasoning, supportsReasoningEffort, reasoningEffortOptions } = entry.model_spec.capabilities;
  if (supportsReasoningEffort) return EFFORTS.find((effort) => reasoningEffortOptions?.includes(effort)) ?? 'low';
  if (supportsReasoning) return 'none';
  return undefined;
}

export const writingTask: AiTask<{ tweets: string[] }> = {
  schema: tweetsSchema,
  check: ({ tweets }) => ({ tweets: checkTweets(tweets) }),
};

// A chat reply comes quickly, and one that isn't the JSON is still the model's answer: its text.
export const chatTask: AiTask<ChatReply> = {
  schema: chatReplyJsonSpec,
  check: checkChatReply,
  quickReply: true,
  onUnreadable: (content) => ({ reply: content, postOptions: [] }),
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
    reasoningEffort: task.quickReply ? reasoningEffort(model) : undefined,
    onUnreadable: task.onUnreadable,
    signal,
  });
  return task.check(reply);
}

/**
 * Runs the task on the user's chosen model of `kind` (or the default one) with the messages
 * `messagesAsync` resolves to, read meanwhile. 502 ai_unavailable when the model is gone or can't do
 * the kind, or when Venice fails; anything else is the error handler's 500. `signal` stops the call.
 */
export async function runChosenModelTask<T>({
  db,
  userId,
  kind,
  task,
  messagesAsync,
  signal,
}: {
  db: Db;
  userId: string;
  kind: AiModelKind;
  task: AiTask<T>;
  messagesAsync: Promise<ChatMessage[]>;
  signal?: AbortSignal;
}): Promise<T> {
  const [modelId, catalog, messages] = await Promise.all([
    readChosenModelId(db, userId, kind),
    catalogAsync(),
    messagesAsync,
  ]);
  const found = findModel(catalog.entries, modelId, kind);
  if ('error' in found) throw AppError.aiUnavailable(`Your ${kind} model: ${found.error}`);
  try {
    return await runTask({ task, messages, model: found.entry, signal });
  } catch (error) {
    if (error instanceof VeniceError) throw AppError.aiUnavailable(error.message);
    throw error;
  }
}
