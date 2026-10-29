import isVerifiedModel from '@/utils/ai/isVerifiedModel';

/**
 * The labels a catalog model has for `kind` (`defaults` from useAiCatalog): Verified, Unrestricted
 * (its resolved Uncensored label), the Default and the Default for Adult content. All false for a
 * model Venice no longer offers (`model` null) or while the defaults load.
 */
export default function modelLabels(kind, model, defaults) {
  if (!model || !defaults) return { isVerified: false, isUnrestricted: false, isDefault: false, isAdultDefault: false };
  return {
    isVerified: isVerifiedModel(kind, model),
    isUnrestricted: model.isUncensored,
    isDefault: defaults[kind].regular === model.id,
    isAdultDefault: defaults[kind].unrestricted === model.id,
  };
}
