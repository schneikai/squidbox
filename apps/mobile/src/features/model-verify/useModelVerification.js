import { MODEL_LABEL_NAMES } from '@squidbox/shared';

import applyAiCatalog from '@/lib/applyAiCatalog';
import modelLabels from '@/utils/ai/modelLabels';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * The labels of the model `modelId` (an ai_admin tool; `model` its catalog model from useAiCatalog,
 * so a mark shows at once, or null once Venice dropped it: then only its defaults are known;
 * `yourModels` the kind's useYourModels): `labels` (modelLabels, with the defaults this account
 * uses), `isVeniceUncensored` (Venice's own label), `defaultName` (the default of yours it is, which
 * keeps it in the list; null for none), `isPublishedDefault(variant)` whether it is that default for
 * everyone, and `setVerified(isVerified)` and `setUncensored(uncensored)`, marks every account sees,
 * which resolve once every screen shows the server's answer, or reject with its reason.
 * `makeDefault(variant)` and `clearDefault(variant)` change this account's pick of that default
 * (`regular` the Default, `unrestricted` the Uncensored default), a local write every screen shows
 * at once.
 */
export default function useModelVerification(kind, modelId, model, yourModels) {
  const { defaults, yourDefaults, rows, pickDefault } = yourModels;

  const labels = modelLabels(kind, modelId, model, yourDefaults);
  const defaultKey = ['default', 'uncensoredDefault'].find((label) => labels[label]);
  const defaultName = defaultKey ? MODEL_LABEL_NAMES[defaultKey] : null;
  const name = rows?.find((row) => row.id === modelId)?.name ?? model?.name ?? modelId;

  return {
    labels,
    isVeniceUncensored: model?.isVeniceUncensored ?? false,
    defaultName,
    isPublishedDefault: (variant) => defaults?.[kind][variant] === modelId,
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, modelId, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(modelId, uncensored)),
    makeDefault: (variant) => pickDefault(variant, { id: modelId, name }),
    clearDefault: (variant) => pickDefault(variant, null),
  };
}
