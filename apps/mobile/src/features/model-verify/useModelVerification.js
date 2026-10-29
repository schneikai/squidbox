import { MODEL_LABEL_NAMES } from '@squidbox/shared';

import useAiCatalog from '@/hooks/useAiCatalog';
import applyAiCatalog from '@/lib/applyAiCatalog';
import modelLabels from '@/utils/ai/modelLabels';
import setModelDefaultAsync from '@/utils/cloud-api/ai/setModelDefaultAsync';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * The labels of the model `modelId` (an ai_admin tool; `model` its catalog model from useAiCatalog,
 * so a mark shows at once, or null once Venice dropped it: then only its defaults are known):
 * `labels` (modelLabels), `isVeniceUncensored` (Venice's own label), `defaultName` (the default of
 * `kind` it is, which keeps it in the list; null for none), and `setVerified(isVerified)`, `setUncensored(uncensored)` and
 * `makeDefault(variant)`, which resolve once every screen shows the server's answer, or reject with
 * its reason.
 */
export default function useModelVerification(kind, modelId, model) {
  const { defaults } = useAiCatalog();

  const labels = modelLabels(kind, modelId, model, defaults);
  const defaultKey = ['default', 'uncensoredDefault'].find((label) => labels[label]);
  const defaultName = defaultKey ? MODEL_LABEL_NAMES[defaultKey] : null;

  return {
    labels,
    isVeniceUncensored: model?.isVeniceUncensored ?? false,
    defaultName,
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, modelId, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(modelId, uncensored)),
    makeDefault: async (variant) => applyAiCatalog(await setModelDefaultAsync(kind, variant, { modelId })),
  };
}
