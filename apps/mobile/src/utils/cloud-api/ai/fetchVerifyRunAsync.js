import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** The model's latest Verify of `kind` and the kind's plan: `{ run, plan }`, `run` null before the first. */
export default async function fetchVerifyRunAsync(kind, modelId) {
  const { data } = await apiWithAuthentication.get(`ai/verify/${kind}/${encodeURIComponent(modelId)}`);
  return data;
}
