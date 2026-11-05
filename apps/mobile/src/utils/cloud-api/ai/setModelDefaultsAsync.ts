import type { AiModelKind, AiModelsResponse, ModelDefaultRequest } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Apply changes for everyone: `picks` (`{ regular, unrestricted }`, a model id each, null for no pick)
 * become the defaults of `kind` for every account; the server keeps the published default of a
 * variant without a pick. Returns the catalog with the new defaults, `{ models, defaults,
 * instructions }`.
 */
export default async function setModelDefaultsAsync(
  kind: AiModelKind,
  picks: ModelDefaultRequest,
): Promise<AiModelsResponse> {
  const { data } = await apiWithAuthentication.put<AiModelsResponse>(`ai/defaults/${kind}`, picks);
  return data;
}
