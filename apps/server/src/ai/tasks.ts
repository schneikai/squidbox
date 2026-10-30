// What the assistant asks a model for: the JSON shape of the reply and the check it must pass, and
// the one call that runs a task on a model (a compare runs it on several at once).
import {
  ASSET_TAG_LIMITS,
  assetTagSchema,
  CHAT_LIMITS,
  uniqueTags,
  type AiModelKind,
  type ChatReply,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import type { User } from '../db/schema.js';
import { AppError } from '../errors.js';
import { catalogAsync, findModel, type CatalogEntry } from './catalog.js';
import { readChosenModelId } from './modelChoices.js';
import { chatReplyJsonSpec, judgeVerdictJsonSpec, postsSchema, tagsSchema } from './prompts.js';
import { chatJsonAsync, VeniceError, type ChatMessage, type JsonSchemaSpec } from './venice.js';

/**
 * The trimmed non-empty tweets, as many as the compare's prompt asked for; throws without any.
 */
export function checkTweets(tweets: string[]): string[] {
  const kept = tweets.map((tweet) => tweet.trim()).filter(Boolean);
  if (kept.length === 0) throw new VeniceError('The model returned no posts');
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
 * What the assistant asks a model for, and the check its reply must pass to be its result, on the
 * model's own defaults. `onUnreadable`: what a reply that isn't the schema's JSON becomes (its text),
 * instead of failing.
 */
export type AiTask<T> = {
  schema: JsonSchemaSpec<T>;
  check: (reply: T) => T;
  onUnreadable?: (content: string, json: unknown) => T;
};

// A compare's posts: one or more (the prompt says how many).
export const writingTask: AiTask<{ posts: string[] }> = {
  schema: postsSchema,
  check: ({ posts }) => ({ posts: checkTweets(posts) }),
};

/**
 * A chat reply that isn't quite the schema's JSON, read as far as it goes: its `reply` when that is a
 * string, with the `postOptions` that are strings (none when it has no list); without a `reply`
 * string, the model's whole text is the reply.
 */
export function readChatReplyLeniently(content: string, json: unknown): ChatReply {
  const { reply, postOptions } = (json ?? {}) as { reply?: unknown; postOptions?: unknown };
  if (typeof reply !== 'string') return { reply: content, postOptions: [] };
  const options = Array.isArray(postOptions) ? postOptions : [];
  return { reply, postOptions: options.filter((option): option is string => typeof option === 'string') };
}

// A chat reply that isn't the JSON is still the model's answer.
export const chatTask: AiTask<ChatReply> = {
  schema: chatReplyJsonSpec,
  check: checkChatReply,
  onUnreadable: readChatReplyLeniently,
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

// The model check's judge: whether a chat turn's reply answered the request, and why in one line.
export const judgeTask: AiTask<{ pass: boolean; reason: string }> = {
  schema: judgeVerdictJsonSpec,
  check: ({ pass, reason }) => ({ pass, reason: reason.trim() }),
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
    onUnreadable: task.onUnreadable,
    signal,
  });
  return task.check(reply);
}

/**
 * Runs the task on the user's model of `kind` (readChosenModelId: an ai_admin's pick, else the
 * published default) with the messages `messagesAsync` resolves to, read meanwhile. 502 ai_unavailable when the model is gone or can't do
 * the kind, or when Venice fails; anything else is the error handler's 500. `signal` stops the call.
 */
export async function runChosenModelTask<T>({
  db,
  user,
  kind,
  task,
  messagesAsync,
  signal,
}: {
  db: Db;
  user: Pick<User, 'id' | 'features'>;
  kind: AiModelKind;
  task: AiTask<T>;
  messagesAsync: Promise<ChatMessage[]>;
  signal?: AbortSignal;
}): Promise<T> {
  const [modelId, catalog, messages] = await Promise.all([
    readChosenModelId(db, user, kind),
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
