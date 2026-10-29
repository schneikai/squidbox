import { MODEL_LABEL_NAMES, type AiModelKind, type ModelDefaults } from './contracts/ai';

/**
 * Whether a label that is on may go off: `defaultName` names the default the model is that keeps it
 * on ("Default", "Default for Adult content", or with its kind when another kind's, like "Vision
 * Default for Adult content"), null when it may go. Turning a label on is never held back: making a
 * model a default turns on what that default needs.
 */
export type LabelLock = { defaultName: string | null };

/** Verified stays on while the model is a default of `kind`. */
export function verifiedLock(kind: AiModelKind, modelId: string, defaults: ModelDefaults): LabelLock {
  if (defaults[kind].regular === modelId) return { defaultName: MODEL_LABEL_NAMES.default };
  if (defaults[kind].unrestricted === modelId) return { defaultName: MODEL_LABEL_NAMES.adultDefault };
  return { defaultName: null };
}
