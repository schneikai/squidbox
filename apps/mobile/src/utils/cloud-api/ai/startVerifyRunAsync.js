import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Starts the model's Verify of `kind` on the server, unless one is running, and returns the running
 * one with the kind's plan (`{ run, plan }`) at once: the run goes on in the background.
 */
export default async function startVerifyRunAsync(kind, modelId) {
  const { data } = await apiWithAuthentication.post(`ai/verify/${kind}/${encodeURIComponent(modelId)}`);
  return data;
}
