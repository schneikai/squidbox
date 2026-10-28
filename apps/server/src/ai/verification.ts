// The marks an ai_admin sets for the whole app (Settings → Assistant → a model list → ⋯): which models
// are verified for each kind, whether a model counts as uncensored (an override of Venice's label,
// or none to follow it), and the defaults the assistant uses while a user chose none. Server-owned
// tables, read by every account through GET /ai/models, never synced (sync-design §12).
import { and, eq } from 'drizzle-orm';
import { modelDefaultsSchema, type AiModelKind, type ModelDefaultVariant, type ModelDefaults } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelDefaults, uncensoredOverrides, verifiedModels } from '../db/schema.js';
import { AppError } from '../errors.js';
import { isUncensored, type CatalogEntry } from './catalog.js';

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

/** The defaults of every kind and variant. */
export async function readModelDefaults(db: Db): Promise<ModelDefaults> {
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
 * Marks the model verified for `kind` or not; a second mark keeps who and when. 400 when unmarking a
 * default of the kind.
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
  await db.transaction(async (tx) => {
    const [isDefault] = await tx
      .select({ variant: modelDefaults.variant })
      .from(modelDefaults)
      .where(and(eq(modelDefaults.kind, kind), eq(modelDefaults.modelId, modelId)));
    if (isDefault)
      throw AppError.validation(`${modelId} is the default ${kind} model; make another model the default first`);
    await tx.delete(verifiedModels).where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId)));
  });
}

/**
 * Sets the model's override of Venice's Uncensored label (`uncensored`; null follows Venice). 400
 * when that leaves an Adult content default of any kind not uncensored. `entry` is the model's
 * catalog entry, null once Venice dropped it: then there is no label to follow, and only false
 * counts as not uncensored.
 */
export async function setUncensored(
  db: Db,
  {
    modelId,
    entry,
    uncensored,
    userId,
  }: { modelId: string; entry: CatalogEntry | null; uncensored: boolean | null; userId: string | null },
): Promise<void> {
  const counts = entry ? isUncensored(entry, uncensored) : uncensored !== false;
  await db.transaction(async (tx) => {
    if (!counts) {
      const [adultDefault] = await tx
        .select({ kind: modelDefaults.kind })
        .from(modelDefaults)
        .where(and(eq(modelDefaults.variant, 'unrestricted'), eq(modelDefaults.modelId, modelId)));
      if (adultDefault) {
        throw AppError.validation(
          `${modelId} is the default ${adultDefault.kind} model for Adult content; make another model that default first`,
        );
      }
    }
    if (uncensored === null) {
      await tx.delete(uncensoredOverrides).where(eq(uncensoredOverrides.modelId, modelId));
      return;
    }
    await tx
      .insert(uncensoredOverrides)
      .values({ modelId, uncensored, setBy: userId })
      .onConflictDoUpdate({
        target: uncensoredOverrides.modelId,
        set: { uncensored, setBy: userId, setAt: new Date() },
      });
  });
}

/**
 * Makes the model the default of `kind` for `variant`. 400 unless it is verified for the kind, and
 * for Adult content (`unrestricted`) unless it counts as uncensored (catalog.ts isUncensored).
 */
export async function setModelDefault(
  db: Db,
  { kind, variant, entry }: { kind: AiModelKind; variant: ModelDefaultVariant; entry: CatalogEntry },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [verified] = await tx
      .select({ modelId: verifiedModels.modelId })
      .from(verifiedModels)
      .where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, entry.id)));
    if (!verified) throw AppError.validation('Mark the model verified first');
    if (variant === 'unrestricted') {
      const [override] = await tx
        .select({ uncensored: uncensoredOverrides.uncensored })
        .from(uncensoredOverrides)
        .where(eq(uncensoredOverrides.modelId, entry.id));
      if (!isUncensored(entry, override?.uncensored ?? null))
        throw AppError.validation('Mark the model uncensored first');
    }
    await tx
      .insert(modelDefaults)
      .values({ kind, variant, modelId: entry.id })
      .onConflictDoUpdate({ target: [modelDefaults.kind, modelDefaults.variant], set: { modelId: entry.id } });
  });
}
