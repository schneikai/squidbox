import type { PullRequest, PullResponse, PushRequest, PushResponse } from '@squidbox/shared';

import { pullChanges, pushMutations } from './api';
import type { SyncIdentity } from '../library/sessionMatches';

// The sync engine talks to the backend through this interface, so tests can inject an
// in-process transport (calling the server's push/pull directly against a test Postgres) while
// production uses the HTTP transport over the authenticated axios instance.
export interface SyncTransport {
  pull(req: PullRequest): Promise<PullResponse>;
  /** `body` is `req` serialized, when the caller has it (the worker measures each mutation's size). */
  push(req: PushRequest, body?: string): Promise<PushResponse>;
}

// Every request runs for `identity`: the tokens are read fresh from the stored session, which must
// still be that user's.
export function httpTransport(identity: SyncIdentity): SyncTransport {
  return {
    pull: (req) => pullChanges(req, identity),
    push: (req, body) => pushMutations(body ?? req, identity),
  };
}
