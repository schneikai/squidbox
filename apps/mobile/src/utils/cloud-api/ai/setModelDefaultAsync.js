import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Makes `body.modelId` the default of `kind` for `variant` (regular, or `unrestricted`: the
 * Uncensored default). Returns the catalog with the new defaults, `{ models, defaults }`.
 */
export default async function setModelDefaultAsync(kind, variant, body) {
  const { data } = await apiWithAuthentication.put(`ai/defaults/${kind}/${variant}`, body);
  return data;
}
