import type { InstructionKind, PublishInstructionRequest, PublishInstructionResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Apply changes for everyone: `body.text` becomes the default of `kind` for every account. Returns
 * the app's default instructions with the new one, `{ instructions }`.
 */
export default async function publishInstructionAsync(
  kind: InstructionKind,
  body: PublishInstructionRequest,
): Promise<PublishInstructionResponse> {
  const { data } = await apiWithAuthentication.put<PublishInstructionResponse>(`ai/instructions/${kind}`, body);
  return data;
}
