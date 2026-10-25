// The one reader of Venice's model list. GET /models answers every model Venice offers right now;
// new models show up and dropped ones disappear with no code change here. The list is cached in
// memory for a few minutes, and a failed refresh throws: it never serves stale data silently.
import type { AiModelKind, ApiAiModel } from '@squidbox/shared';
import { z } from 'zod';

const CACHE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

// The cost line's assumptions: a writing reply reads ~1,000 tokens and writes ~200; tagging a
// photo reads ~1,500 (the image and the prompt) and writes ~100.
const REPLY_INPUT_TOKENS = 1000;
const REPLY_OUTPUT_TOKENS = 200;
const PHOTO_INPUT_TOKENS = 1500;
const PHOTO_OUTPUT_TOKENS = 100;

// Lenient: only the fields this server reads; Venice adds fields freely.
const catalogEntrySchema = z.object({
  id: z.string().min(1),
  model_spec: z.object({
    name: z.string().min(1),
    pricing: z.object({
      input: z.object({ usd: z.number() }),
      output: z.object({ usd: z.number() }),
    }),
    capabilities: z
      .object({
        supportsVision: z.boolean().optional(),
        supportsReasoningEffort: z.boolean().optional(),
        reasoningEffortOptions: z.array(z.string()).optional(),
      })
      .default({}),
    traits: z.array(z.string()).default([]),
  }),
});
export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

const catalogResponseSchema = z.object({ data: z.array(z.unknown()) });

export type VeniceAccess = { baseUrl: string; apiKey: string };

/**
 * Venice's current models. An entry that lacks a field this server needs (a name, prices) is left
 * out rather than failing the whole list.
 */
export async function fetchCatalogAsync({ baseUrl, apiKey }: VeniceAccess): Promise<CatalogEntry[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Venice model list failed (${response.status})`);
  const body = catalogResponseSchema.parse(await response.json());
  return body.data.flatMap((entry) => {
    const parsed = catalogEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

let cache: { at: number; baseUrl: string; entries: CatalogEntry[] } | null = null;

/** The catalog, fetched at most once per CACHE_MS. Throws when a needed refresh fails. */
export async function getCatalogAsync(access: VeniceAccess, now = Date.now()): Promise<CatalogEntry[]> {
  if (cache && cache.baseUrl === access.baseUrl && now - cache.at < CACHE_MS) return cache.entries;
  const entries = await fetchCatalogAsync(access);
  cache = { at: now, baseUrl: access.baseUrl, entries };
  return entries;
}

/** Forgets the cached catalog (tests). */
export function clearCatalogCache(): void {
  cache = null;
}

/** Venice's own uncensored label: "Uncensored" in the name, or its most_uncensored trait. */
export function isUncensored(entry: CatalogEntry): boolean {
  return /uncensored/i.test(entry.model_spec.name) || entry.model_spec.traits.includes('most_uncensored');
}

/**
 * The lowest reasoning effort a model takes, so a reasoning model answers in seconds instead of
 * thinking for a minute: 'none' when offered, else 'low'; undefined for a model without the setting.
 */
export function reasoningEffortFor(entry: CatalogEntry): 'none' | 'low' | undefined {
  const { supportsReasoningEffort, reasoningEffortOptions = [] } = entry.model_spec.capabilities;
  if (!supportsReasoningEffort) return undefined;
  return reasoningEffortOptions.includes('none') ? 'none' : 'low';
}

function costUsd(entry: CatalogEntry, inputTokens: number, outputTokens: number): number {
  const { input, output } = entry.model_spec.pricing; // USD per 1M tokens
  return (inputTokens * input.usd + outputTokens * output.usd) / 1_000_000;
}

/** A catalog entry as the app shows it, with the estimated costs. */
export function toApiModel(entry: CatalogEntry): ApiAiModel {
  const supportsVision = entry.model_spec.capabilities.supportsVision === true;
  return {
    id: entry.id,
    name: entry.model_spec.name,
    supportsVision,
    isUncensored: isUncensored(entry),
    costPerReplyUsd: costUsd(entry, REPLY_INPUT_TOKENS, REPLY_OUTPUT_TOKENS),
    costPer100PhotosUsd: supportsVision ? 100 * costUsd(entry, PHOTO_INPUT_TOKENS, PHOTO_OUTPUT_TOKENS) : null,
  };
}

/** The model for a compare of that kind, or why it can't be used. */
export function findModel(
  catalog: CatalogEntry[],
  id: string,
  kind: AiModelKind,
): { entry: CatalogEntry } | { error: string } {
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return { error: `Unknown ${kind} model: ${id}` };
  if (kind === 'vision' && entry.model_spec.capabilities.supportsVision !== true) {
    return { error: `${entry.model_spec.name} can't see photos` };
  }
  return { entry };
}
