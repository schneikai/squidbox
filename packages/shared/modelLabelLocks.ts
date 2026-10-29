import {
  aiModelKindSchema,
  MODEL_LABEL_NAMES,
  type AiModelKind,
  type ModelDefaults,
  type ModelLabel,
} from './contracts/ai';

/** Whether a label may change from its value now, and the reason to show when it may not (null: none to show). */
export type LabelLock = { locked: boolean; reason: string | null };

const KIND_NAMES: Record<AiModelKind, string> = { writing: 'Writing', vision: 'Vision' };

const lock = (locked: boolean, reason: string | null = null): LabelLock => ({
  locked,
  reason: locked ? reason : null,
});

/** Verified can't go while the model is a default of `kind`. */
export function verifiedLock(kind: AiModelKind, modelId: string, defaults: ModelDefaults): LabelLock {
  const isDefault = defaults[kind].regular === modelId;
  return lock(
    isDefault || defaults[kind].unrestricted === modelId,
    `It's the ${isDefault ? MODEL_LABEL_NAMES.default : MODEL_LABEL_NAMES.adultDefault}`,
  );
}

/**
 * Unrestricted can't go while the model is the Default for Adult content of any kind; the reason
 * names that kind unless it is `kind` (null: the caller has no kind, so it is always named).
 */
export function unrestrictedLock(kind: AiModelKind | null, modelId: string, defaults: ModelDefaults): LabelLock {
  // The kind it is the Default for Adult content of, `kind` first.
  const adultKind = [kind, ...aiModelKindSchema.options].find(
    (each): each is AiModelKind => each !== null && defaults[each].unrestricted === modelId,
  );
  const named = adultKind && adultKind !== kind ? `${KIND_NAMES[adultKind]} ` : '';
  return lock(adultKind !== undefined, `It's the ${named}${MODEL_LABEL_NAMES.adultDefault}`);
}

/**
 * The rules of a model's labels for `kind`, one source for the server's guards and the app's switches:
 * Verified (verifiedLock) and Unrestricted (unrestrictedLock) stay while the model is a default;
 * Default and Default for Adult content need Verified (the adult one Unrestricted too), and once on,
 * only making another model the default turns them off.
 */
export function modelLabelLocks({
  kind,
  modelId,
  isVerified,
  isUncensored,
  defaults,
}: {
  kind: AiModelKind;
  modelId: string;
  isVerified: boolean;
  isUncensored: boolean;
  defaults: ModelDefaults;
}): Record<ModelLabel, LabelLock> {
  const isDefault = defaults[kind].regular === modelId;
  const isAdultDefault = defaults[kind].unrestricted === modelId;
  const verifyFirst = `Turn on ${MODEL_LABEL_NAMES.verified} first`;

  return {
    verified: verifiedLock(kind, modelId, defaults),
    unrestricted: unrestrictedLock(kind, modelId, defaults),
    default: lock(!isVerified || isDefault, isDefault ? null : verifyFirst),
    adultDefault: lock(
      !isVerified || !isUncensored || isAdultDefault,
      isAdultDefault ? null : !isVerified ? verifyFirst : `Turn on ${MODEL_LABEL_NAMES.unrestricted} first`,
    ),
  };
}
