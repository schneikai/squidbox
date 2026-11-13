import { CLIENT_HEADER, clientHeaderVersion, CONTRACT_VERSION, UPDATE_REQUIRED_STATUS } from '@squidbox/shared';
import type { FastifyInstance } from 'fastify';
import { updateRequiredBody } from '../errors.js';

/**
 * The update gate (docs/sync-design.md §15): a request whose client header names a contract version
 * below this server's gets UPDATE_REQUIRED_STATUS. A request without the header counts as the first
 * version, as builds from before the header left it out: it passes until the first raise.
 */
export function registerClientVersionGate(api: FastifyInstance): void {
  api.addHook('onRequest', async (request, reply) => {
    const header = request.headers[CLIENT_HEADER];
    const version = clientHeaderVersion(typeof header === 'string' ? header : undefined);
    if (version >= CONTRACT_VERSION) return;
    return reply
      .code(UPDATE_REQUIRED_STATUS)
      .send(updateRequiredBody(`This build speaks contract version ${version}; the server needs ${CONTRACT_VERSION}`));
  });
}
