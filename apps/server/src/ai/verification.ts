// The marks an ai_admin sets for the whole app (Settings → Assistant → a model list → a model): which models
// are verified for each kind, whether a model counts as uncensored (an override of Venice's label,
// or none to follow it), and the defaults the assistant uses while a user chose none. Server-owned
// tables, read by every account through GET /ai/models, never synced (sync-design §12).
import { and, eq } from 'drizzle-orm';
import {
  modelDefaultsSchema,
  unrestrictedLock,
  verifiedLock,
  type AiModelKind,
  type LabelLock,
  type ModelDefaultVariant,
  type ModelDefaults,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelDefaults, uncensoredOverrides, verifiedModels } from '../db/schema.js';
import { AppError } from '../errors.js';
import { isUncensored, isVeniceUncensored, type CatalogEntry } from './catalog.js';

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

// What a guard needs of a model in `tx`: whether it is verified for `kind`, its Uncensored override
// (null: follows Venice) and the defaults.
async function readLabels(tx: Pick<Db, 'select'>, kind: AiModelKind, modelId: string) {
  const [[verified], [override], defaults] = await Promise.all([
    tx
      .select({ modelId: verifiedModels.modelId })
      .from(verifiedModels)
      .where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId))),
    tx
      .select({ uncensored: uncensoredOverrides.uncensored })
      .from(uncensoredOverrides)
      .where(eq(uncensoredOverrides.modelId, modelId)),
    readModelDefaults(tx),
  ]);
  return { isVerified: verified !== undefined, override: override?.uncensored ?? null, defaults };
}

// Refuses to turn off a label that modelLabelLocks (shared) keeps on, naming the default it is.
function refuseLocked(lock: LabelLock): void {
  if (lock.defaultName) throw AppError.validation(`It's the ${lock.defaultName}`);
}

/**
 * Marks the model verified for `kind` or not; a second mark keeps who and when. 400 when unmarking a
 * default of the kind (verifiedLock).
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
    const defaults = await readModelDefaults(tx);
    refuseLocked(verifiedLock(kind, modelId, defaults));
    await tx.delete(verifiedModels).where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId)));
  });
}

/**
 * Sets the model's override of Venice's Uncensored label (`uncensored`; null follows Venice). 400
 * when that leaves the Default for Adult content of any kind not uncensored (unrestrictedLock).
 * `entry` is the model's catalog entry, null once Venice dropped it: then there is no label to
 * follow, and only false counts as not uncensored.
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
      const defaults = await readModelDefaults(tx);
      refuseLocked(unrestrictedLock(null, modelId, defaults));
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
 * Makes the model the default of `kind` for `variant`, and turns on what that default needs: Verified
 * for the kind, and for Adult content (`unrestricted`) Unrestricted, by following Venice when Venice
 * rates it uncensored, else by an override.
 */
export async function setModelDefault(
  db: Db,
  {
    kind,
    variant,
    entry,
    userId,
  }: { kind: AiModelKind; variant: ModelDefaultVariant; entry: CatalogEntry; userId: string | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const { isVerified, override, defaults } = await readLabels(tx, kind, entry.id);
    if (defaults[kind][variant] === entry.id) return;
    if (!isVerified) await tx.insert(verifiedModels).values({ kind, modelId: entry.id, verifiedBy: userId });
    if (variant === 'unrestricted' && !isUncensored(entry, override)) {
      if (isVeniceUncensored(entry)) {
        await tx.delete(uncensoredOverrides).where(eq(uncensoredOverrides.modelId, entry.id));
      } else {
        await tx
          .insert(uncensoredOverrides)
          .values({ modelId: entry.id, uncensored: true, setBy: userId })
          .onConflictDoUpdate({
            target: uncensoredOverrides.modelId,
            set: { uncensored: true, setBy: userId, setAt: new Date() },
          });
      }
    }
    await tx
      .insert(modelDefaults)
      .values({ kind, variant, modelId: entry.id })
      .onConflictDoUpdate({ target: [modelDefaults.kind, modelDefaults.variant], set: { modelId: entry.id } });
  });
}
