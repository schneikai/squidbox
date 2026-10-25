// The Venice client: nothing else talks to Venice. It owns the key and address (from the config),
// and asks for JSON that matches a schema and validates what comes back.
import type { z } from 'zod';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';

const CHAT_TIMEOUT_MS = 60_000;

/** A Venice call that failed; its message is shown on the model's card. */
export class VeniceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceError';
  }
}

/**
 * Before any call: 503 ai_not_configured when the server has no Venice key, 403 ai_not_allowed for
 * an account that AI_ALLOWED_EMAILS leaves out.
 */
export function requireVenice(email: string): void {
  const { VENICE_API_KEY, AI_ALLOWED_EMAILS } = loadConfig();
  if (!VENICE_API_KEY) throw AppError.aiNotConfigured();
  if (AI_ALLOWED_EMAILS && !AI_ALLOWED_EMAILS.includes(email.toLowerCase())) throw AppError.aiNotAllowed();
}

/** A request to Venice's API at `path`, with the key and a timeout. */
export function veniceFetch(
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

export type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user'; content: string | ChatContentPart[] };

export type JsonSchemaSpec<T> = { name: string; jsonSchema: Record<string, unknown>; zod: z.ZodType<T> };

type ChatJsonOptions<T> = {
  model: string;
  reasoningEffort?: 'none' | 'low';
  maxTokens: number;
  messages: ChatMessage[];
  schema: JsonSchemaSpec<T>;
};

type ChatCompletion = {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
};

/** One chat completion whose reply is JSON of `schema`; anything else is a VeniceError. */
export async function chatJsonAsync<T>({
  model,
  reasoningEffort,
  maxTokens,
  messages,
  schema,
}: ChatJsonOptions<T>): Promise<T> {
  const response = await veniceFetch('/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      response_format: {
        type: 'json_schema',
        json_schema: { name: schema.name, strict: true, schema: schema.jsonSchema },
      },
      // Venice's own system prompt would shape the compare; thinking text must not reach the JSON.
      venice_parameters: {
        include_venice_system_prompt: false,
        strip_thinking_response: true,
        disable_thinking: true,
      },
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
