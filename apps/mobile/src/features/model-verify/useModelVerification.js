import useAiCatalog, { applyAiCatalog } from '@/hooks/useAiCatalog';
import isVerifiedModel from '@/utils/ai/isVerifiedModel';
import setModelDefaultAsync from '@/utils/cloud-api/ai/setModelDefaultAsync';
import setUncensoredAsync from '@/utils/cloud-api/ai/setUncensoredAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * A catalog model's marks (an ai_admin tool; `model` from useAiCatalog, so a mark shows at once):
 * `isVerified` for `kind`, `uncensoredOverride` (true or false overrides Venice's Uncensored label,
 * null follows it, whatever the kind), `isVeniceUncensored` (Venice's own label),
 * `isDefault.regular` / `isDefault.unrestricted` for `kind`, and `setVerified(isVerified)`,
 * `setUncensored(uncensored)` and `makeDefault(variant)`, which resolve once every screen shows the
 * server's answer, or reject with its reason.
 */
export default function useModelVerification(kind, model) {
  const { defaults } = useAiCatalog();
  const { id } = model;

  return {
    isVerified: isVerifiedModel(kind, model),
    uncensoredOverride: model.uncensoredOverride,
    isVeniceUncensored: model.isVeniceUncensored,
    isDefault: { regular: defaults?.[kind].regular === id, unrestricted: defaults?.[kind].unrestricted === id },
    setVerified: async (isVerified) => applyAiCatalog(await setVerificationAsync(kind, id, isVerified)),
    setUncensored: async (uncensored) => applyAiCatalog(await setUncensoredAsync(id, uncensored)),
    makeDefault: async (variant) => applyAiCatalog(await setModelDefaultAsync(kind, variant, { modelId: id })),
  };
}
