import { modelLabelLocks } from '@squidbox/shared';

import isVerifiedModel from '@/utils/ai/isVerifiedModel';

/**
 * The labels the model `modelId` has for `kind` (`model` its catalog model, null once Venice dropped
 * it; `defaults` from useAiCatalog), by MODEL_LABEL_NAMES' keys: `verified`, `unrestricted` (its
 * resolved Uncensored label), `default` and `adultDefault` (from modelLabelLocks: a default's lock
 * names it while the model is that default). A dropped model keeps only its defaults (they're the
 * server's, by id); all false while the defaults load.
 */
export default function modelLabels(kind, modelId, model, defaults) {
  if (!defaults) return { verified: false, unrestricted: false, default: false, adultDefault: false };
  const locks = modelLabelLocks({ kind, modelId, defaults });
  return {
    verified: model ? isVerifiedModel(kind, model) : false,
    unrestricted: model ? model.isUncensored : false,
    default: locks.default.defaultName !== null,
    adultDefault: locks.adultDefault.defaultName !== null,
  };
}
