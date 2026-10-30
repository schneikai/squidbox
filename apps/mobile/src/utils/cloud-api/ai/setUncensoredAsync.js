import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Sets the model's override of Venice's Uncensored label, whatever the kind: `uncensored` true or
 * false, or null to follow Venice. Returns the catalog with the new marks, `{ models, defaults }`.
 */
export default async function setUncensoredAsync(modelId, uncensored) {
  const { data } = await apiWithAuthentication.put(`ai/uncensored/${encodeURIComponent(modelId)}`, { uncensored });
  return data;
}
