import type { PullRequest, PullResponse, PushRequest, PushResponse } from '@squidbox/shared';
import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// Sync transport → the new backend's /api/v1/sync/{pull,push}. Uses the authenticated axios
// instance (Bearer token injection + 401 refresh), whose baseURL points at the new backend.

export async function pullChanges(req: PullRequest): Promise<PullResponse> {
  const { data } = await apiWithAuthentication.post('sync/pull', req);
  return data as PullResponse;
}

export async function pushMutations(req: PushRequest): Promise<PushResponse> {
  const { data } = await apiWithAuthentication.post('sync/push', req);
  return data as PushResponse;
}
