import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { pullRequestSchema, pushRequestSchema } from '@squidbox/shared';
import { getDb } from '../db/client.js';
import { requireUserId, authenticate } from '../auth/authenticate.js';
import { pull } from './pull.js';
import { push } from './push.js';

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const db = getDb();

  // POST /sync/pull — cursor-based pull of all registered collections.
  r.route({
    method: 'POST',
    url: '/sync/pull',
    preHandler: authenticate(),
    schema: { body: pullRequestSchema },
    handler: (request) => pull(db, requireUserId(request), request.body),
  });

  // POST /sync/push — whole-record LWW upsert, per-mutation results.
  r.route({
    method: 'POST',
    url: '/sync/push',
    preHandler: authenticate(),
    schema: { body: pushRequestSchema },
    handler: async (request) => ({ results: await push(db, requireUserId(request), request.body.mutations) }),
  });
}
