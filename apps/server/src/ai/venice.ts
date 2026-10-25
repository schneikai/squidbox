// The Venice client: nothing else talks to Venice's chat API. Venice is OpenAI-compatible; this
// asks for JSON that matches a schema and validates what comes back.
import type { z } from 'zod';
import type { VeniceAccess } from './catalog.js';

const REQUEST_TIMEOUT_MS = 60_000;

/** A Venice call that failed; its message is shown on the model's card. */
export class VeniceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VeniceError';
  }
}

export type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type ChatMessage = { role: 'system' | 'user'; content: string | ChatContentPart[] };

export type JsonSchemaSpec<T> = { name: string; jsonSchema: Record<string, unknown>; zod: z.ZodType<T> };

type ChatJsonOptions<T> = VeniceAccess & {
  model: string;
  reasoningEffort?: 'none' | 'low';
  maxTokens: number;
  messages: ChatMessage[];
  schema: JsonSchemaSpec<T>;
  signal?: AbortSignal;
};

type ChatCompletion = {
  choices?: { finish_reason?: string | null; message?: { content?: string | null; refusal?: string | null } }[];
};

/** One chat completion whose reply is JSON of `schema`; anything else is a VeniceError. */
export async function chatJsonAsync<T>({
  baseUrl,
  apiKey,
  model,
  reasoningEffort,
  maxTokens,
  messages,
  schema,
  signal,
}: ChatJsonOptions<T>): Promise<T> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
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
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  }).catch((error: unknown) => {
    if (signal?.aborted) throw error;
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new VeniceError(timedOut ? 'Venice took too long to answer' : "Couldn't reach Venice");
  });

  const body = (await response.json().catch(() => null)) as (ChatCompletion & { error?: unknown }) | null;
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
