// The marks an ai_admin sets for the whole app (Settings → Assistant → a model list → ⋯): which models
// are verified for each kind, whether each counts as uncensored (an override of Venice's label, or
// null to follow it), and the defaults the assistant uses while a user chose none. Server-owned
// tables, read by every account through GET /ai/models, never synced (sync-design §12).
import { and, eq } from 'drizzle-orm';
import {
  aiModelKindSchema,
  MODEL_DEFAULT_VARIANTS,
  type AiModelKind,
  type ModelDefaultVariant,
  type ModelDefaults,
} from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { modelDefaults, verifiedModels } from '../db/schema.js';
import { AppError } from '../errors.js';

/** The verified models of each kind, by id, with their override of Venice's Uncensored label. */
export type VerifiedModels = Record<AiModelKind, Map<string, { unrestricted: boolean | null }>>;

export type Verification = { verified: VerifiedModels; defaults: ModelDefaults };

const invalid = (message: string) => new AppError(400, 'validation_error', message);

// The four defaults as one object. A missing one is a broken seed, so it throws (a 500), never a
// fallback in code.
function toDefaults(rows: { kind: string; variant: string; modelId: string }[]): ModelDefaults {
  const find = (kind: AiModelKind, variant: ModelDefaultVariant) => {
    const row = rows.find((each) => each.kind === kind && each.variant === variant);
    if (!row) throw new Error(`No default ${kind} model for ${variant}`);
    return row.modelId;
  };
  return Object.fromEntries(
    aiModelKindSchema.options.map((kind) => [
      kind,
      Object.fromEntries(MODEL_DEFAULT_VARIANTS.map((variant) => [variant, find(kind, variant)])),
    ]),
  ) as ModelDefaults;
}

/** The defaults of every kind and variant. */
export async function readModelDefaults(db: Db): Promise<ModelDefaults> {
  return toDefaults(await db.select().from(modelDefaults));
}

/** Every mark: the verified models of each kind and the defaults. */
export async function readVerification(db: Db): Promise<Verification> {
  const [rows, defaultRows] = await Promise.all([
    db
      .select({ kind: verifiedModels.kind, modelId: verifiedModels.modelId, unrestricted: verifiedModels.unrestricted })
      .from(verifiedModels),
    db.select().from(modelDefaults),
  ]);
  const verified: VerifiedModels = { writing: new Map(), vision: new Map() };
  for (const row of rows) verified[row.kind as AiModelKind]?.set(row.modelId, { unrestricted: row.unrestricted });
  return { verified, defaults: toDefaults(defaultRows) };
}

/**
 * Marks the model verified for `kind` or not. Verified, `isUnrestricted` is its override of Venice's
 * label (null follows it, `isVeniceUncensored`); the first mark records who and when, a later one
 * changes only the override. 400 when that would leave the kind's Adult content default not
 * uncensored, when unmarking a default, or for an override on an unverified model.
 */
export async function setVerification(
  db: Db,
  {
    kind,
    modelId,
    isVerified,
    isUnrestricted,
    isVeniceUncensored = false,
    userId,
  }: {
    kind: AiModelKind;
    modelId: string;
    isVerified: boolean;
    isUnrestricted: boolean | null;
    isVeniceUncensored?: boolean;
    userId: string | null;
  },
): Promise<void> {
  if (!isVerified && isUnrestricted !== null) throw invalid('Mark the model verified first');
  await db.transaction(async (tx) => {
    const defaults = await tx
      .select({ variant: modelDefaults.variant })
      .from(modelDefaults)
      .where(and(eq(modelDefaults.kind, kind), eq(modelDefaults.modelId, modelId)));
    const variants = new Set(defaults.map(({ variant }) => variant));
    if (isVerified) {
      if (variants.has('unrestricted') && !(isUnrestricted ?? isVeniceUncensored)) {
        throw invalid(
          `${modelId} is the default ${kind} model for Adult content; make another model that default first`,
        );
      }
      await tx
        .insert(verifiedModels)
        .values({ kind, modelId, unrestricted: isUnrestricted, verifiedBy: userId })
        .onConflictDoUpdate({
          target: [verifiedModels.kind, verifiedModels.modelId],
          set: { unrestricted: isUnrestricted },
        });
      return;
    }
    if (variants.size > 0)
      throw invalid(`${modelId} is the default ${kind} model; make another model the default first`);
    await tx.delete(verifiedModels).where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId)));
  });
}

/**
 * Makes the model the default of `kind` for `variant`. 400 unless it is verified for the kind, and
 * for Adult content (`unrestricted`) unless it counts as uncensored: its override, else Venice's
 * label (`isVeniceUncensored`).
 */
export async function setModelDefault(
  db: Db,
  {
    kind,
    variant,
    modelId,
    isVeniceUncensored,
  }: { kind: AiModelKind; variant: ModelDefaultVariant; modelId: string; isVeniceUncensored: boolean },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ unrestricted: verifiedModels.unrestricted })
      .from(verifiedModels)
      .where(and(eq(verifiedModels.kind, kind), eq(verifiedModels.modelId, modelId)));
    if (!row) throw invalid('Mark the model verified first');
    if (variant === 'unrestricted' && !(row.unrestricted ?? isVeniceUncensored)) {
      throw invalid('Mark the model uncensored first');
    }
    await tx
      .insert(modelDefaults)
      .values({ kind, variant, modelId })
      .onConflictDoUpdate({ target: [modelDefaults.kind, modelDefaults.variant], set: { modelId } });
  });
}
