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
    handler: async (request) => {
      const userId = requireUserId(request);
      const res = await pull(db, userId, request.body);
      const count = Object.values(res.changes).reduce((n, c) => n + c.records.length, 0);
      // Structured, user_id-tagged log (sync-design §13) — untagged logs are undebuggable multi-tenant.
      request.log.info(
        { userId, op: 'pull', fromCursor: request.body.cursor ?? 0, toCursor: res.cursor, records: count, hasMore: res.hasMore },
        'sync.pull',
      );
      return res;
    },
  });

  // POST /sync/push — whole-record LWW upsert, per-mutation results.
  r.route({
    method: 'POST',
    url: '/sync/push',
    preHandler: authenticate(),
    schema: { body: pushRequestSchema },
    handler: async (request) => {
      const userId = requireUserId(request);
      const results = await push(db, userId, request.body.mutations);
      const tally = { applied: 0, 'skipped-lww': 0, rejected: 0 } as Record<string, number>;
      for (const r of results) tally[r.status] += 1;
      request.log.info(
        { userId, op: 'push', mutations: request.body.mutations.length, ...tally },
        'sync.push',
      );
      return { results };
    },
  });
}
