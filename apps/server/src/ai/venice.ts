// The Venice client: nothing else talks to Venice. It owns the key and address (from the config),
// reads Venice's JSON endpoints, and runs chat completions, plain or as JSON that matches a schema.
import type { z } from 'zod';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';

// Models reason at their defaults, which can take a minute or two (Qwen 3.6 Plus: 35–69 s).
const CHAT_TIMEOUT_MS = 150_000;
const GET_TIMEOUT_MS = 15_000;

/** A read from Venice a route can't answer without: 502 ai_unavailable with `message` when it fails. */
export async function orAiUnavailable<T>(promise: Promise<T>, message: string): Promise<T> {
  try {
    return await promise;
  } catch {
    throw AppError.aiUnavailable(message);
  }
}

/** A model's call or reply that failed; its message is shown on the model's card. */
export class VeniceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceError';
  }
}

/**
 * Venice itself didn't answer: it couldn't be reached, took too long, or answered an error. Unlike
 * the model's own failures (a refusal, a cut-off or unreadable reply), it says nothing about the model.
 */
export class VeniceUnavailableError extends VeniceError {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceUnavailableError';
  }
}

/** A request to Venice's API at `path`, with the key and a timeout; `signal` stops it sooner. */
function veniceFetch(
  path: string,
  {
    headers,
    timeoutMs,
    signal,
    ...init
  }: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs: number; signal?: AbortSignal },
): Promise<Response> {
  const { VENICE_API_KEY: apiKey, VENICE_BASE_URL: baseUrl } = loadConfig();
  if (!apiKey) throw AppError.aiNotConfigured();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, authorization: `Bearer ${apiKey}` },
    signal: signal ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal]) : AbortSignal.timeout(timeoutMs),
  });
}

/** GET `path` as `schema` describes it. Throws when Venice doesn't answer it. */
export async function veniceGetJson<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
  const response = await veniceFetch(path, { timeoutMs: GET_TIMEOUT_MS });
  if (!response.ok) throw new Error(`Venice ${path} failed (${response.status})`);
  return schema.parse(await response.json());
}

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] };

export type JsonSchemaSpec<T> = { name: string; jsonSchema: Record<string, unknown>; zod: z.ZodType<T> };

type ChatCompletion = {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
};

/**
 * One chat completion's reply text. Every way it can fail is a VeniceError that says why: Venice
 * unreachable, slow or answering an error is a VeniceUnavailableError; a refusal, a cut-off,
 * filtered or empty reply a plain VeniceError. `signal`
 * stops it, when nobody waits for the reply anymore.
 */
async function chatCompletionAsync({
  model,
  messages,
  signal,
  ...extra
}: {
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  response_format?: Record<string, unknown>;
}): Promise<string> {
  const response = await veniceFetch('/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      ...extra,
      // Every model runs on Venice's defaults (reasoning, effort, reply length). Venice's own system
      // prompt would shape the reply, and thinking text must not reach it.
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
    }),
    timeoutMs: CHAT_TIMEOUT_MS,
    signal,
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new VeniceUnavailableError(timedOut ? 'Venice took too long to answer' : "Couldn't reach Venice");
  });

  // The timeout also covers reading the body: a cut-off reply is a slow one, not an empty one.
  const body = (await response.json().catch((error: unknown) => {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new VeniceUnavailableError('Venice took too long to answer');
    }
    return null;
  })) as (ChatCompletion & { error?: unknown }) | null;
  if (!response.ok)
    throw new VeniceUnavailableError(errorMessage(body) ?? `Venice request failed (${response.status})`);

  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) throw new VeniceError(`The model refused: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') throw new VeniceError('The reply was cut off');
  if (choice?.finish_reason === 'content_filter') throw new VeniceError('The reply was blocked by a content filter');

  const content = choice?.message?.content;
  if (!content) throw new VeniceError('The reply was empty');
  return content;
}

/**
 * One chat completion whose reply is JSON of `schema`; anything else is a VeniceError, unless
 * `onUnreadable` is given: then a reply that isn't that JSON is `onUnreadable(its text, the JSON
 * object found in it or null)`. A model
 * without `supportsResponseSchema` is asked without the schema (the messages say the shape), and
 * its reply may wrap the JSON in a code fence or words.
 */
export async function chatJsonAsync<T>({
  model,
  messages,
  schema,
  supportsResponseSchema = true,
  onUnreadable,
  signal,
}: {
  model: string;
  messages: ChatMessage[];
  schema: JsonSchemaSpec<T>;
  supportsResponseSchema?: boolean;
  onUnreadable?: (content: string, json: unknown) => T;
  signal?: AbortSignal;
}): Promise<T> {
  const responseFormat = {
    type: 'json_schema',
    json_schema: { name: schema.name, strict: true, schema: schema.jsonSchema },
  };
  const content = await chatCompletionAsync({
    model,
    messages,
    signal,
    ...(supportsResponseSchema && { response_format: responseFormat }),
  });
  const json = parseJsonReply(content);
  const parsed = schema.zod.safeParse(json);
  if (parsed.success) return parsed.data;
  if (onUnreadable) return onUnreadable(content, json);
  throw new VeniceError("The reply couldn't be read");
}

// The reply's JSON object: the whole reply, a ```json fenced block in it, or from its first { to
// its last }; null when there is none.
function parseJsonReply(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content)?.[1] ?? '';
  for (const text of [content, fenced, content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)]) {
    try {
      return JSON.parse(text);
    } catch {
      // the next form
    }
  }
  return null;
}

// Venice answers errors as { error: { message } } or, on some routes, { error: "…" }.
function errorMessage(body: { error?: unknown } | null): string | null {
  const error = body?.error;
  if (typeof error === 'string' && error) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return null;
}
