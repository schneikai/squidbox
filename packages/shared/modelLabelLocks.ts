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

/**
 * The rules of a model's labels for `kind`, one source for the server's guards and the app's switches:
 * - Verified can't go while the model is a default of the kind.
 * - Unrestricted can't go while it is the Default for Adult content of any kind.
 * - Default and Default for Adult content need Verified (the adult one Unrestricted too); once on,
 *   only making another model the default turns them off.
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
  // The kind it is the Default for Adult content of, this one first.
  const adultDefaultKind = isAdultDefault
    ? kind
    : aiModelKindSchema.options.find((each) => defaults[each].unrestricted === modelId);
  const verifyFirst = `Turn on ${MODEL_LABEL_NAMES.verified} first`;
  const lock = (locked: boolean, reason: string | null = null): LabelLock => ({
    locked,
    reason: locked ? reason : null,
  });

  return {
    verified: lock(
      isDefault || isAdultDefault,
      `It's the ${isDefault ? MODEL_LABEL_NAMES.default : MODEL_LABEL_NAMES.adultDefault}`,
    ),
    unrestricted: lock(
      adultDefaultKind !== undefined,
      `It's the ${adultDefaultKind && adultDefaultKind !== kind ? `${KIND_NAMES[adultDefaultKind]} ` : ''}${MODEL_LABEL_NAMES.adultDefault}`,
    ),
    default: lock(!isVerified || isDefault, isDefault ? null : verifyFirst),
    adultDefault: lock(
      !isVerified || !isUncensored || isAdultDefault,
      isAdultDefault ? null : !isVerified ? verifyFirst : `Turn on ${MODEL_LABEL_NAMES.unrestricted} first`,
    ),
  };
}
