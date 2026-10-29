import { MODEL_DEFAULT_LABELS, MODEL_LABEL_NAMES } from '@squidbox/shared';

import applyAiCatalog from '@/lib/applyAiCatalog';
import modelLabels from '@/utils/ai/modelLabels';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * The labels of the model `modelId` named `name` (an ai_admin tool; `model` its catalog model from
 * useAiCatalog, so a mark shows at once, or null once Venice dropped it: then only its defaults are
 * known; `defaults`, `yourDefaults` and `pickDefault` the kind's useYourModels'): `labels`
 * (modelLabels, with the defaults this account uses), `isVeniceUncensored` (Venice's own label),
 * `defaultName` (the default of yours it is, which keeps it in the list; null for none),
 * `isPublishedDefault(variant)` whether it is that default for everyone, and `setVerified(isVerified)`
 * and `setUncensored(uncensored)`, marks every account sees, which resolve once every screen shows
 * the server's answer, or reject with its reason. `setDefault(variant, isOn)` picks it as this
 * account's default of that variant, or goes back to the published one, a local write every screen
 * shows at once.
 */
export default function useModelVerification(kind, { modelId, name, model }, { defaults, yourDefaults, pickDefault }) {
  const labels = modelLabels(kind, modelId, model, yourDefaults);
  const defaultKey = Object.keys(MODEL_DEFAULT_LABELS).find((label) => labels[label]);
  const defaultName = defaultKey ? MODEL_LABEL_NAMES[defaultKey] : null;

  return {
    labels,
    isVeniceUncensored: model?.isVeniceUncensored ?? false,
    defaultName,
    isPublishedDefault: (variant) => defaults?.[kind][variant] === modelId,
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, modelId, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(modelId, uncensored)),
    setDefault: (variant, isOn) => pickDefault(variant, isOn ? { id: modelId, name } : null),
  };
}
