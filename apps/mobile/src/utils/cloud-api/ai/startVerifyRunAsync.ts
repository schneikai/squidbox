import type { AiModelKind, VerifyRunResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/**
 * Starts the model's Verify of `kind` on the server, unless one is running, and returns the running
 * one with the kind's plan (`{ run, plan }`) at once: the run goes on in the background.
 */
export default async function startVerifyRunAsync(kind: AiModelKind, modelId: string): Promise<VerifyRunResponse> {
  const { data } = await apiWithAuthentication.post<VerifyRunResponse>(
    `ai/verify/${kind}/${encodeURIComponent(modelId)}`,
  );
  return data;
}
