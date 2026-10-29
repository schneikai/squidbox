import isVerifiedModel from '@/utils/ai/isVerifiedModel';

/**
 * The labels a catalog model has for `kind` (`defaults` from useAiCatalog), by MODEL_LABEL_NAMES'
 * keys: `verified`, `unrestricted` (its resolved Uncensored label), `default` and `adultDefault`. All
 * false for a model Venice no longer offers (`model` null) or while the defaults load.
 */
export default function modelLabels(kind, model, defaults) {
  if (!model || !defaults) return { verified: false, unrestricted: false, default: false, adultDefault: false };
  return {
    verified: isVerifiedModel(kind, model),
    unrestricted: model.isUncensored,
    default: defaults[kind].regular === model.id,
    adultDefault: defaults[kind].unrestricted === model.id,
  };
}
