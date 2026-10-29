import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Make default for everyone: `body.text` becomes the default of `kind` for every account. Returns
 * the catalog with the new instructions, `{ models, defaults, instructions }`.
 */
export default async function publishInstructionAsync(kind, body) {
  const { data } = await apiWithAuthentication.put(`ai/instructions/${kind}`, body);
  return data;
}
