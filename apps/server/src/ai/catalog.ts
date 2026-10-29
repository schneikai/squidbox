// The one reader of Venice's model list. GET /models answers every model Venice offers right now;
// new models show up and dropped ones disappear with no code change here. The list is cached in
// memory for a few minutes, and a failed refresh throws: it never serves stale data silently.
import { aiModelKindSchema, type AiModelKind, type ApiAiModel } from '@squidbox/shared';
import { z } from 'zod';
import { orAiUnavailable, veniceGetJson } from './venice.js';
import type { Verification } from './verification.js';

const CACHE_MS = 5 * 60 * 1000;

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
        // false for a model that can't hold its reply to a JSON schema (it gets the shape in words)
        supportsResponseSchema: z.boolean().optional(),
        // whether the model reasons, and at which effort by default (display only)
        // (lenient: a display field never drops a model from the catalog)
        supportsReasoning: z.boolean().nullish().catch(undefined),
        defaultReasoningEffort: z.string().nullish().catch(undefined),
      })
      .default({}),
    traits: z.array(z.string()).default([]),
  }),
});
export type CatalogEntry = z.infer<typeof catalogEntrySchema>;

const catalogResponseSchema = z.object({ data: z.array(z.unknown()) });

/** The catalog's entries. The marks (verification.ts) are read with each request, never cached. */
export type Catalog = { entries: CatalogEntry[] };

/**
 * Venice's current models. An entry that lacks a field this server needs (a name, prices) is left
 * out rather than failing the whole list.
 */
export async function fetchCatalogAsync(): Promise<CatalogEntry[]> {
  const body = await veniceGetJson('/models', catalogResponseSchema);
  return body.data.flatMap((entry) => {
    const parsed = catalogEntrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

// The fetch is cached as its promise, so the requests that arrive while it runs share it; a failed
// one is dropped at once, so the next request tries again.
let cache: { at: number; promise: Promise<Catalog> } | null = null;

/** The catalog, fetched at most once per CACHE_MS. Throws when a needed refresh fails. */
export function getCatalogAsync(now = Date.now()): Promise<Catalog> {
  if (cache && now - cache.at < CACHE_MS) return cache.promise;
  const entry = {
    at: now,
    promise: fetchCatalogAsync().then((entries) => ({ entries })),
  };
  cache = entry;
  entry.promise.catch(() => {
    if (cache === entry) cache = null;
  });
  return entry.promise;
}

/** Forgets the cached catalog (tests). */
export function clearCatalogCache(): void {
  cache = null;
}

/** Venice's own Uncensored label: "Uncensored" in the model's name, or its most_uncensored trait. */
export function isVeniceUncensored(entry: CatalogEntry): boolean {
  return /uncensored/i.test(entry.model_spec.name) || entry.model_spec.traits.includes('most_uncensored');
}

/**
 * Whether the app labels the model Uncensored, the one place that works it out: its override
 * (`override`, null follows Venice), else Venice's label. So an abliterated model Venice doesn't
 * label can be marked uncensored, and one it labels can be marked not.
 */
export function isUncensored(entry: CatalogEntry, override: boolean | null): boolean {
  return override ?? isVeniceUncensored(entry);
}

function costUsd(entry: CatalogEntry, inputTokens: number, outputTokens: number): number {
  const { input, output } = entry.model_spec.pricing; // USD per 1M tokens
  return (inputTokens * input.usd + outputTokens * output.usd) / 1_000_000;
}

/** A catalog entry as the app shows it, with the estimated costs and the marks of `verification`. */
export function toApiModel(
  entry: CatalogEntry,
  { verified, overrides }: Pick<Verification, 'verified' | 'overrides'>,
): ApiAiModel {
  const { capabilities } = entry.model_spec;
  const supportsVision = capabilities.supportsVision === true;
  const override = overrides.get(entry.id) ?? null;
  return {
    id: entry.id,
    name: entry.model_spec.name,
    supportsVision,
    isUncensored: isUncensored(entry, override),
    isVeniceUncensored: isVeniceUncensored(entry),
    verifiedKinds: aiModelKindSchema.options.filter((kind) => verified[kind].has(entry.id)),
    uncensoredOverride: override,
    reasoning: {
      supported: capabilities.supportsReasoning === true,
      defaultEffort: capabilities.defaultReasoningEffort ?? null,
    },
    costPerReplyUsd: costUsd(entry, REPLY_INPUT_TOKENS, REPLY_OUTPUT_TOKENS),
    costPer100PhotosUsd: supportsVision ? 100 * costUsd(entry, PHOTO_INPUT_TOKENS, PHOTO_OUTPUT_TOKENS) : null,
  };
}

/**
 * The model for a compare of that kind (null: any kind), or why it can't be used, without its name
 * (the compare is blind).
 */
export function findModel(
  catalog: CatalogEntry[],
  id: string,
  kind: AiModelKind | null,
): { entry: CatalogEntry } | { error: string } {
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) return { error: 'Venice no longer offers this model' };
  if (kind === 'vision' && entry.model_spec.capabilities.supportsVision !== true) {
    return { error: "This model can't see photos" };
  }
  return { entry };
}

/** The catalog for a route: 502 ai_unavailable when Venice's model list can't be loaded. */
export function catalogAsync(): Promise<Catalog> {
  return orAiUnavailable(getCatalogAsync(), "Couldn't load the models from Venice");
}
