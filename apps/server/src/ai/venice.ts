// The Venice client: nothing else talks to Venice. It owns the key and address (from the config),
// reads Venice's JSON endpoints, and runs chat completions, plain or as JSON that matches a schema.
import type { z } from 'zod';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';

// Models think at their default effort, which can take a minute or two.
const CHAT_TIMEOUT_MS = 150_000;
const GET_TIMEOUT_MS = 15_000;

/** A model's call or reply that failed; its message is shown on the model's card. */
export class VeniceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceError';
  }
}

/** A request to Venice's API at `path`, with the key and a timeout. */
function veniceFetch(
  path: string,
  { headers, timeoutMs, ...init }: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs: number },
): Promise<Response> {
  const { VENICE_API_KEY: apiKey, VENICE_BASE_URL: baseUrl } = loadConfig();
  if (!apiKey) throw AppError.aiNotConfigured();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** GET `path` as `schema` describes it. Throws when Venice doesn't answer it. */
export async function veniceGetJson<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
  const response = await veniceFetch(path, { timeoutMs: GET_TIMEOUT_MS });
  if (!response.ok) throw new Error(`Venice ${path} failed (${response.status})`);
  return schema.parse(await response.json());
}

export type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] };

export type JsonSchemaSpec<T> = { name: string; jsonSchema: Record<string, unknown>; zod: z.ZodType<T> };

type ChatCompletion = {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
};

/**
 * One chat completion's reply text. Every way it can fail (Venice unreachable or slow, an error
 * answer, a refusal, a cut-off, filtered or empty reply) is a VeniceError that says why.
 */
export async function chatCompletionAsync({
  model,
  messages,
  ...extra
}: {
  model: string;
  messages: ChatMessage[];
  response_format?: Record<string, unknown>;
}): Promise<string> {
  const response = await veniceFetch('/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      ...extra,
      // Every model runs on its own defaults (effort, thinking, reply length). Venice's own system
      // prompt would shape the reply, and thinking text must not reach it.
      venice_parameters: { include_venice_system_prompt: false, strip_thinking_response: true },
    }),
    timeoutMs: CHAT_TIMEOUT_MS,
  }).catch((error: unknown) => {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new VeniceError(timedOut ? 'Venice took too long to answer' : "Couldn't reach Venice");
  });

  // The timeout also covers reading the body: a cut-off reply is a slow one, not an empty one.
  const body = (await response.json().catch((error: unknown) => {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new VeniceError('Venice took too long to answer');
    }
    return null;
  })) as (ChatCompletion & { error?: unknown }) | null;
  if (!response.ok) throw new VeniceError(errorMessage(body) ?? `Venice request failed (${response.status})`);

  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) throw new VeniceError(`The model refused: ${choice.message.refusal}`);
  if (choice?.finish_reason === 'length') throw new VeniceError('The reply was cut off');
  if (choice?.finish_reason === 'content_filter') throw new VeniceError('The reply was blocked by a content filter');

  const content = choice?.message?.content;
  if (!content) throw new VeniceError('The reply was empty');
  return content;
}

/** One chat completion whose reply is JSON of `schema`; anything else is a VeniceError. */
export async function chatJsonAsync<T>({
  model,
  messages,
  schema,
}: {
  model: string;
  messages: ChatMessage[];
  schema: JsonSchemaSpec<T>;
}): Promise<T> {
  const content = await chatCompletionAsync({
    model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schema.name, strict: true, schema: schema.jsonSchema },
    },
  });
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new VeniceError("The reply couldn't be read");
  }
  const parsed = schema.zod.safeParse(json);
  if (!parsed.success) throw new VeniceError("The reply couldn't be read");
  return parsed.data;
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
