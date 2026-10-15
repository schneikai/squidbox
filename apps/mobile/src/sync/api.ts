import type { PullRequest, PullResponse, PushRequest, PushResponse } from '@squidbox/shared';

import type { SyncIdentity } from '../library/sessionMatches';

import apiWithAuthentication from '@/utils/cloud-api/apiWithAuthentication';

// The identity a request runs for (read by apiWithAuthentication's interceptors).
declare module 'axios' {
  interface AxiosRequestConfig {
    identity?: SyncIdentity;
  }
}

// Sync transport → the backend's /api/v1/sync/{pull,push}, over the authenticated axios instance
// (a fresh Bearer token per request, for the given identity, and the 401 refresh).

export async function pullChanges(req: PullRequest, identity: SyncIdentity): Promise<PullResponse> {
  const { data } = await apiWithAuthentication.post('sync/pull', req, { identity });
  return data as PullResponse;
}

export async function pushMutations(req: PushRequest, identity: SyncIdentity): Promise<PushResponse> {
  const { data } = await apiWithAuthentication.post('sync/push', req, { identity });
  return data as PushResponse;
}
