import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Marks the model verified for `kind` or not (`isVerified`). Returns the catalog with the new marks,
 * `{ models, defaults }`.
 */
export default async function setVerificationAsync(kind, modelId, isVerified) {
  const { data } = await apiWithAuthentication.put(`ai/verification/${kind}/${encodeURIComponent(modelId)}`, {
    isVerified,
  });
  return data;
}
