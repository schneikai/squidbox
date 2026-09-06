import type { PullRequest, PullResponse, PushRequest, PushResponse } from '@squidbox/shared';
import { pullChanges, pushMutations } from './api';

// The sync engine talks to the backend through this interface, so tests can inject an
// in-process transport (calling the server's push/pull directly against a test Postgres) while
// production uses the HTTP transport over the authenticated axios instance.
export interface SyncTransport {
  pull(req: PullRequest): Promise<PullResponse>;
  push(req: PushRequest): Promise<PushResponse>;
}

export const httpTransport: SyncTransport = {
  pull: pullChanges,
  push: pushMutations,
};
