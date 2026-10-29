// The marks an ai_admin sets for the whole app (Settings → Assistant → a model list → a model):
// which models are verified for each kind, whether a model counts as uncensored (an override of
// Venice's label, or none to follow it), and the defaults every account uses (an ai_admin's own
// picks apply to them, modelChoices.ts). Server-owned tables, read by every account through
// GET /ai/models, never synced (sync-design §12).
import { and, eq, sql } from 'drizzle-orm';
import {
  MODEL_DEFAULT_VARIANTS,
  modelDefaultsSchema,
  type AiModelKind,
  type ModelDefaultVariants,
  type ModelDefaults,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelDefaults, uncensoredOverrides, verifiedModels } from '../db/schema.js';

export type Verification = {
  /** The ids of the verified models of each kind. */
  verified: Record<AiModelKind, Set<string>>;
  /** The overrides of Venice's Uncensored label, by model id; a model without one follows Venice. */
  overrides: Map<string, boolean>;
  defaults: ModelDefaults;
};

// The four defaults as one object. A missing one is a broken seed, so parsing throws (a 500), never
// a fallback in code.
function toDefaults(rows: { kind: string; variant: string; modelId: string }[]): ModelDefaults {
  const defaults: Record<string, Record<string, string>> = { writing: {}, vision: {} };
  for (const { kind, variant, modelId } of rows) defaults[kind] = { ...defaults[kind], [variant]: modelId };
  return modelDefaultsSchema.parse(defaults);
}

/** The defaults of every kind and variant (`db` may be a transaction). */
export async function readModelDefaults(db: Pick<Db, 'select'>): Promise<ModelDefaults> {
  return toDefaults(await db.select().from(modelDefaults));
}

/** Every mark: the verified models of each kind, the Uncensored overrides and the defaults. */
export async function readVerification(db: Db): Promise<Verification> {
  const [rows, overrideRows, defaults] = await Promise.all([
    db.select({ kind: verifiedModels.kind, modelId: verifiedModels.modelId }).from(verifiedModels),
    db
      .select({ modelId: uncensoredOverrides.modelId, uncensored: uncensoredOverrides.uncensored })
      .from(uncensoredOverrides),
    readModelDefaults(db),
  ]);
  const verified: Verification['verified'] = { writing: new Set(), vision: new Set() };
  for (const row of rows) verified[row.kind as AiModelKind]?.add(row.modelId);
  const overrides = new Map(overrideRows.map((row) => [row.modelId, row.uncensored]));
  return { verified, overrides, defaults };
}

/**
 * Marks the model verified for `kind` or not; a second mark keeps who and when. A label is a flag of
 * its own: a default may be unverified.
 */
export async function setVerification(
  db: Db,
  {
    kind,
    modelId,
    isVerified,
    userId,
  }: { kind: AiModelKind; modelId: string; isVerified: boolean; userId: string | null },
): Promise<void> {
  if (isVerified) {
    await db.insert(verifiedModels).values({ kind, modelId, verifiedBy: userId }).onConflictDoNothing();
    return;
  }
  await db.delete(verifiedModels).where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId)));
}

/**
 * Sets the model's override of Venice's Uncensored label (`uncensored`; null follows Venice). A
 * label is a flag of its own: the Uncensored default may be a model that isn't uncensored.
 */
export async function setUncensored(
  db: Db,
  { modelId, uncensored, userId }: { modelId: string; uncensored: boolean | null; userId: string | null },
): Promise<void> {
  if (uncensored === null) {
    await db.delete(uncensoredOverrides).where(eq(uncensoredOverrides.modelId, modelId));
    return;
  }
  await db
    .insert(uncensoredOverrides)
    .values({ modelId, uncensored, setBy: userId })
    .onConflictDoUpdate({
      target: uncensoredOverrides.modelId,
      set: { uncensored, setBy: userId, setAt: new Date() },
    });
}

/**
 * Makes the models the two defaults of `kind` (Apply changes for everyone), in one statement so a
 * failure leaves both as they were. It changes no label: Verified and Uncensored are flags of their
 * own.
 */
export async function setModelDefaults(
  db: Db,
  { kind, defaults }: { kind: AiModelKind; defaults: ModelDefaultVariants },
): Promise<void> {
  await db
    .insert(modelDefaults)
    .values(MODEL_DEFAULT_VARIANTS.map((variant) => ({ kind, variant, modelId: defaults[variant] })))
    .onConflictDoUpdate({
      target: [modelDefaults.kind, modelDefaults.variant],
      set: { modelId: sql`excluded.model_id` },
    });
}
