import isVerifiedModel from '@/utils/ai/isVerifiedModel';

/**
 * The labels the model `modelId` has for `kind` (`model` its catalog model, null once Venice dropped
 * it; `defaults` from useAiCatalog), by MODEL_LABEL_NAMES' keys: `verified`, `uncensored` (its
 * resolved Uncensored label), `default` and `uncensoredDefault`. Each is a flag of its own: a
 * default may be unverified or not uncensored. A dropped model keeps only its defaults (they're the server's,
 * by id); all false while the defaults load.
 */
export default function modelLabels(kind, modelId, model, defaults) {
  if (!defaults) return { verified: false, uncensored: false, default: false, uncensoredDefault: false };
  return {
    verified: model ? isVerifiedModel(kind, model) : false,
    uncensored: model ? model.isUncensored : false,
    default: defaults[kind].regular === modelId,
    uncensoredDefault: defaults[kind].unrestricted === modelId,
  };
}
