import type { AiModelKind, AiModelsResponse, VerificationRequest } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Marks the model verified for `kind` or not (`isVerified`). Returns the catalog with the new marks,
 * `{ models, defaults }`.
 */
export default async function setVerificationAsync(
  kind: AiModelKind,
  modelId: string,
  isVerified: boolean,
): Promise<AiModelsResponse> {
  const body: VerificationRequest = { isVerified };
  const { data } = await apiWithAuthentication.put<AiModelsResponse>(
    `ai/verification/${kind}/${encodeURIComponent(modelId)}`,
    body,
  );
  return data;
}
