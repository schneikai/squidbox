import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { contactFromXProfileRequestSchema, contactFromXProfileResponseSchema } from '@squidbox/shared';
import { authenticate } from '../auth/authenticate.js';
import { untilClientLeaves } from '../untilClientLeaves.js';
import { readContactFromXProfileAsync } from './contactFromXProfile.js';

// The contacts' routes: for every signed-in account, not behind the assistant's gate.
export async function contactRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /contacts/x-profile — From link on a New contact: what the public X profile of a handle
  // shows (readContactFromXProfileAsync). Each request is one fetch of x.com. Never a 5xx for what X
  // gave: the status says it. Nothing is stored.
  r.route({
    method: 'POST',
    url: '/contacts/x-profile',
    preHandler: authenticate(),
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: { body: contactFromXProfileRequestSchema, response: { 200: contactFromXProfileResponseSchema } },
    handler: async (request, reply) =>
      readContactFromXProfileAsync({
        handle: request.body.handle,
        signal: untilClientLeaves(reply),
        log: request.log,
      }),
  });
}
