import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Marks the model verified for `kind` or not, with `body` `{ isVerified, isUnrestricted }`
 * (isUnrestricted: true or false overrides Venice's label, null follows it). Returns the catalog
 * with the new marks, `{ models, defaults }`.
 */
export default async function setVerificationAsync(kind, modelId, body) {
  const { data } = await apiWithAuthentication.put(`ai/verification/${kind}/${encodeURIComponent(modelId)}`, body);
  return data;
}
