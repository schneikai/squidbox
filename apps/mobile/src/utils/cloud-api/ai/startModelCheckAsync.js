import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Starts the model's check of `kind` on the server, unless one is running, and returns the running
 * check (ModelCheck) at once: the run goes on in the background.
 */
export default async function startModelCheckAsync(kind, modelId) {
  const { data } = await apiWithAuthentication.post(`ai/checks/${kind}/${encodeURIComponent(modelId)}`);
  return data.check;
}
