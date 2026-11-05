import type { AiModelsResponse, UncensoredRequest } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Sets the model's override of Venice's Uncensored label, whatever the kind: `uncensored` true or
 * false, or null to follow Venice. Returns the catalog with the new marks, `{ models, defaults }`.
 */
export default async function setUncensoredAsync(
  modelId: string,
  uncensored: UncensoredRequest['uncensored'],
): Promise<AiModelsResponse> {
  const body: UncensoredRequest = { uncensored };
  const { data } = await apiWithAuthentication.put<AiModelsResponse>(
    `ai/uncensored/${encodeURIComponent(modelId)}`,
    body,
  );
  return data;
}
