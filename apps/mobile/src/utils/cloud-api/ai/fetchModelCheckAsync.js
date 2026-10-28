import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** The model's latest check of `kind` (ModelCheck), or null before its first. */
export default async function fetchModelCheckAsync(kind, modelId) {
  const { data } = await apiWithAuthentication.get(`ai/checks/${kind}/${encodeURIComponent(modelId)}`);
  return data.check;
}
