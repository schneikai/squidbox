import { CLIENT_HEADER, CONTRACT_VERSION, UPDATE_REQUIRED_STATUS } from '@squidbox/shared';
import type { FastifyInstance } from 'fastify';
import { errorBody, UPDATE_REQUIRED_CODE } from '../errors.js';

// The contract version a header names (`<commit> <device> <version>`, docs/sync-design.md §15, The
// update gate). A header without a version (every build from before the gate) or with one that isn't
// a positive integer counts as 1: refusing it would end a session on auth/refresh.
function headerVersion(header: string): number {
  const version = Number(header.trim().split(/\s+/)[2]);
  return Number.isInteger(version) && version > 0 ? version : 1;
}

/**
 * The update gate: a request whose client header names a contract version below this server's
 * (CONTRACT_VERSION) gets UPDATE_REQUIRED_STATUS, and the app asks its user to update. A request
 * without the header isn't the app (tests, curl, the health check) and passes. The only reader of
 * the header.
 */
export function registerClientVersionGate(api: FastifyInstance): void {
  api.addHook('onRequest', async (request, reply) => {
    const header = request.headers[CLIENT_HEADER];
    if (typeof header !== 'string') return;
    const version = headerVersion(header);
    if (version >= CONTRACT_VERSION) return;
    return reply
      .code(UPDATE_REQUIRED_STATUS)
      .send(
        errorBody(
          UPDATE_REQUIRED_CODE,
          `This build speaks contract version ${version}; the server needs ${CONTRACT_VERSION}`,
        ),
      );
  });
}
