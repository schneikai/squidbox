import {
  aiModelKindSchema,
  MODEL_LABEL_NAMES,
  type AiModelKind,
  type ModelDefaults,
  type ModelLabel,
} from './contracts/ai';

/**
 * Whether a label that is on may go off: `defaultName` names the default the model is that keeps it
 * on ("Default", "Default for Adult content", or with its kind when another kind's, like "Vision
 * Default for Adult content"), null when it may go. Turning a label on is never held back: making a
 * model a default turns on what that default needs.
 */
export type LabelLock = { defaultName: string | null };

const KIND_NAMES: Record<AiModelKind, string> = { writing: 'Writing', vision: 'Vision' };

/** Verified stays on while the model is a default of `kind`. */
export function verifiedLock(kind: AiModelKind, modelId: string, defaults: ModelDefaults): LabelLock {
  if (defaults[kind].regular === modelId) return { defaultName: MODEL_LABEL_NAMES.default };
  if (defaults[kind].unrestricted === modelId) return { defaultName: MODEL_LABEL_NAMES.adultDefault };
  return { defaultName: null };
}

/**
 * Unrestricted stays on while the model is the Default for Adult content of any kind; the name has
 * that kind unless it is `kind` (null: the caller has no kind, so it is always named).
 */
export function unrestrictedLock(kind: AiModelKind | null, modelId: string, defaults: ModelDefaults): LabelLock {
  // The kind it is the Default for Adult content of, `kind` first.
  const adultKind = [kind, ...aiModelKindSchema.options].find(
    (each): each is AiModelKind => each !== null && defaults[each].unrestricted === modelId,
  );
  if (!adultKind) return { defaultName: null };
  const named = adultKind !== kind ? `${KIND_NAMES[adultKind]} ` : '';
  return { defaultName: `${named}${MODEL_LABEL_NAMES.adultDefault}` };
}

/**
 * The rules of a model's labels for `kind`, one source for the server's guards and the app's switches:
 * Verified (verifiedLock) and Unrestricted (unrestrictedLock) stay on while the model is a default,
 * and a default stays on until another model takes it.
 */
export function modelLabelLocks({
  kind,
  modelId,
  defaults,
}: {
  kind: AiModelKind;
  modelId: string;
  defaults: ModelDefaults;
}): Record<ModelLabel, LabelLock> {
  return {
    verified: verifiedLock(kind, modelId, defaults),
    unrestricted: unrestrictedLock(kind, modelId, defaults),
    default: { defaultName: defaults[kind].regular === modelId ? MODEL_LABEL_NAMES.default : null },
    adultDefault: { defaultName: defaults[kind].unrestricted === modelId ? MODEL_LABEL_NAMES.adultDefault : null },
  };
}
