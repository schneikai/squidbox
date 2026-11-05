import type { AiModelsResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Every model Venice offers now with Squidbox's marks, the model defaults and the app's default
 * instructions: `{ models, defaults, instructions }` (aiModelsResponseSchema), from the server
 * (apps/server/src/ai/routes.ts).
 */
export default async function fetchAiModelsAsync(): Promise<AiModelsResponse> {
  const { data } = await apiWithAuthentication.get<AiModelsResponse>('ai/models');
  return data;
}
