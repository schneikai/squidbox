import { MODEL_LABEL_NAMES, type AiModelKind, type ModelDefaults, type ModelLabel } from './contracts/ai';
import { unrestrictedLock } from './unrestrictedLock';
import { verifiedLock, type LabelLock } from './verifiedLock';

/**
 * The rules of a model's labels for `kind`, one source for the server's guards and the app's labels
 * and switches: Verified (verifiedLock) and Unrestricted (unrestrictedLock) stay on while the model
 * is a default, and a default stays on until another model takes it (its lock names it while the
 * model is that default).
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
