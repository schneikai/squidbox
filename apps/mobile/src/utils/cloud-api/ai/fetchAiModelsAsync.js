import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Every model Venice offers now with Squidbox's marks, and the defaults: `{ models, defaults }`
 * (aiModelsResponseSchema), from the server (apps/server/src/ai/routes.ts).
 */
export default async function fetchAiModelsAsync() {
  const { data } = await apiWithAuthentication.get('ai/models');
  return data;
}
