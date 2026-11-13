import { CLIENT_HEADER, clientHeaderVersion, CONTRACT_VERSION, UPDATE_REQUIRED_STATUS } from '@squidbox/shared';
import type { FastifyInstance } from 'fastify';
import { errorBody, UPDATE_REQUIRED_CODE } from '../errors.js';

/**
 * The update gate (docs/sync-design.md §15): a request whose client header names a contract version
 * below this server's gets UPDATE_REQUIRED_STATUS. A request without the header isn't the app (tests,
 * curl, the health check) and passes.
 */
export function registerClientVersionGate(api: FastifyInstance): void {
  api.addHook('onRequest', async (request, reply) => {
    const header = request.headers[CLIENT_HEADER];
    if (typeof header !== 'string') return;
    const version = clientHeaderVersion(header);
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
