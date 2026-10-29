import { MODEL_DEFAULT_LABELS, MODEL_LABEL_NAMES } from '@squidbox/shared';

import applyAiCatalog from '@/lib/applyAiCatalog';
import modelLabels from '@/utils/ai/modelLabels';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * The labels of the model `modelId` named `name` (an ai_admin tool; `model` its catalog model, null
 * once Venice dropped it; the rest the kind's useYourModels'): `labels` (modelLabels),
 * `isVeniceUncensored`, `defaultName` (the default it is, yours or everyone's, which keeps it in the
 * list), `isPublishedDefault(variant)`, the server marks `setVerified` and `setUncensored`, and
 * `setDefault(variant, isOn)`, this account's pick of that default (a local write).
 */
export default function useModelVerification(kind, { modelId, name, model }, { defaults, yourDefaults, pickDefault }) {
  const labels = modelLabels(kind, modelId, model, yourDefaults, defaults);
  const isPublishedDefault = (variant) => defaults?.[kind][variant] === modelId;
  // A default of yours, or one everyone uses (Reset changes or another device could bring it back).
  const defaultKey = Object.keys(MODEL_DEFAULT_LABELS).find(
    (label) => labels[label] || isPublishedDefault(MODEL_DEFAULT_LABELS[label]),
  );
  const defaultName = defaultKey ? MODEL_LABEL_NAMES[defaultKey] : null;

  return {
    labels,
    isVeniceUncensored: model?.isVeniceUncensored ?? false,
    defaultName,
    isPublishedDefault,
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, modelId, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(modelId, uncensored)),
    setDefault: (variant, isOn) => pickDefault(variant, isOn ? { id: modelId, name } : null),
  };
}
