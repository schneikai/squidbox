import { MODEL_DEFAULT_LABELS } from '@squidbox/shared';

import isVerifiedModel from '@/utils/ai/isVerifiedModel';

/**
 * The labels the model `modelId` has for `kind` (`model` its catalog model, null once Venice
 * dropped it; `yourDefaults` the defaults this account uses, useYourModels'), by
 * MODEL_LABEL_NAMES' keys: `verified`, `uncensored` (its resolved Uncensored label), `default` and
 * `uncensoredDefault`. Each is a flag of its own: a default may be unverified or not uncensored. A
 * dropped model keeps only its defaults (they're by id); all false while the defaults load.
 */
export default function modelLabels(kind, modelId, model, yourDefaults) {
  if (!yourDefaults) return { verified: false, uncensored: false, default: false, uncensoredDefault: false };
  return {
    verified: model ? isVerifiedModel(kind, model) : false,
    uncensored: model ? model.isUncensored : false,
    ...Object.fromEntries(
      Object.entries(MODEL_DEFAULT_LABELS).map(([label, variant]) => [label, yourDefaults[kind][variant] === modelId]),
    ),
  };
}
