import { MODEL_LABEL_NAMES, modelLabelLocks } from '@squidbox/shared';

import useAiCatalog from '@/hooks/useAiCatalog';
import applyAiCatalog from '@/lib/applyAiCatalog';
import modelLabels from '@/utils/ai/modelLabels';
import setModelDefaultAsync from '@/utils/cloud-api/ai/setModelDefaultAsync';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

const LOCKED = { locked: true, reason: null };
const ALL_LOCKED = { verified: LOCKED, unrestricted: LOCKED, default: LOCKED, adultDefault: LOCKED };

/**
 * The labels of the model `modelId` (an ai_admin tool; `model` its catalog model from useAiCatalog,
 * so a mark shows at once, or null once Venice dropped it: then only its defaults are known): `labels` (modelLabels), `locks` (modelLabelLocks: whether each may
 * change, and why not; all locked without a model or while the defaults load), `isVeniceUncensored`
 * (Venice's own label), `defaultName` (the default it is, null for none), and `setVerified(isVerified)`,
 * `setUncensored(uncensored)` and `makeDefault(variant)`, which resolve once every screen shows the
 * server's answer, or reject with its reason.
 */
export default function useModelVerification(kind, modelId, model) {
  const { defaults } = useAiCatalog();

  const labels = modelLabels(kind, modelId, model, defaults);
  const locks =
    model && defaults
      ? modelLabelLocks({
          kind,
          modelId,
          isVerified: labels.verified,
          isUncensored: labels.unrestricted,
          defaults,
        })
      : ALL_LOCKED;
  const defaultName = labels.default
    ? MODEL_LABEL_NAMES.default
    : labels.adultDefault
      ? MODEL_LABEL_NAMES.adultDefault
      : null;

  return {
    labels,
    locks,
    isVeniceUncensored: model?.isVeniceUncensored ?? false,
    defaultName,
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, modelId, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(modelId, uncensored)),
    makeDefault: async (variant) => applyAiCatalog(await setModelDefaultAsync(kind, variant, { modelId })),
  };
}
