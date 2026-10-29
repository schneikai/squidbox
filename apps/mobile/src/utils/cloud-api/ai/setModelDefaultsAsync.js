import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Make default for everyone: `defaults` (`{ regular, unrestricted }`, model ids) become the two
 * defaults of `kind` for every account, both at once. Returns the catalog with the new defaults,
 * `{ models, defaults, instructions }`.
 */
export default async function setModelDefaultsAsync(kind, defaults) {
  const { data } = await apiWithAuthentication.put(`ai/defaults/${kind}`, defaults);
  return data;
}
