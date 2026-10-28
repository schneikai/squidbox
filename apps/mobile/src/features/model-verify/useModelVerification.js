import { useCallback } from 'react';

import useAiCatalog, { applyAiCatalog } from '@/hooks/useAiCatalog';
import setModelDefaultAsync from '@/utils/cloud-api/ai/setModelDefaultAsync';
import setVerificationAsync from '@/utils/cloud-api/ai/setVerificationAsync';

/**
 * A catalog model's marks for `kind` (an ai_admin tool), live from the catalog: `isVerified`,
 * `unrestrictedMark` (true or false overrides Venice's Uncensored label, null follows it),
 * `isVeniceUncensored` (Venice's own label), `isDefault.regular` / `isDefault.unrestricted`, and
 * `setVerification({ isVerified, isUnrestricted })` and `makeDefault(variant)`, which resolve once
 * every screen shows the server's answer, or reject with its reason.
 */
export default function useModelVerification(kind, model) {
  const { models, defaults } = useAiCatalog();
  const id = model.id;

  const setVerification = useCallback(
    async (body) => applyAiCatalog(await setVerificationAsync(kind, id, body)),
    [kind, id],
  );
  const makeDefault = useCallback(
    async (variant) => applyAiCatalog(await setModelDefaultAsync(kind, variant, { modelId: id })),
    [kind, id],
  );

  // The catalog's copy, so a mark shows at once.
  const current = models?.find((each) => each.id === id) ?? model;
  return {
    isVerified: current.verifiedKinds.includes(kind),
    unrestrictedMark: current.unrestrictedMarks[kind],
    isVeniceUncensored: current.isVeniceUncensored,
    isDefault: { regular: defaults?.[kind].regular === id, unrestricted: defaults?.[kind].unrestricted === id },
    setVerification,
    makeDefault,
  };
}
