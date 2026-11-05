import type { AiModelKind, VerifyRunResponse } from '@squidbox/shared';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

/** The model's latest Verify of `kind` and the kind's plan: `{ run, plan }`, `run` null before the first. */
export default async function fetchVerifyRunAsync(kind: AiModelKind, modelId: string): Promise<VerifyRunResponse> {
  const { data } = await apiWithAuthentication.get<VerifyRunResponse>(
    `ai/verify/${kind}/${encodeURIComponent(modelId)}`,
  );
  return data;
}
