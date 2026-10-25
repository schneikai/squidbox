import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** Every model Venice offers now (ApiAiModel[]), from the server (apps/server/src/ai/routes.ts). */
export default async function fetchAiModelsAsync() {
  const { data } = await apiWithAuthentication.get('ai/models');
  return data.models;
}
