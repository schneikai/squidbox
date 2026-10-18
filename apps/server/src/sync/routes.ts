import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { pullRequestSchema, pushRequestSchema } from '@squidbox/shared';
import { getDb } from '../db/client.js';
import { requireUser, authenticate } from '../auth/authenticate.js';
import { loadConfig } from '../config.js';
import { resolveStorage } from '../storage/resolver.js';
import { deleteObjects } from '../storage/s3.js';
import { pull } from './pull.js';
import { push } from './push.js';
import { cleanUpPurgedFiles } from './purgedFiles.js';

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
      const userId = requireUser(request).id;
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

  // POST /sync/push — per-field LWW merge, per-mutation results.
  r.route({
    method: 'POST',
    url: '/sync/push',
    preHandler: authenticate(),
    schema: { body: pushRequestSchema },
    handler: async (request) => {
      const user = requireUser(request);
      const userId = user.id;
      const results = await push(db, userId, request.body.mutations);
      // After the reply, one at a time per user. A failure leaves the push applied; the next push retries (§7a).
      const loc = resolveStorage(user, loadConfig().S3_SHARED_BUCKET);
      cleanUpPurgedFiles(db, userId, (keys) => deleteObjects(loc, keys), (err) =>
        request.log.error({ userId, err }, 'sync.push: deleting purged files failed')
      );
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
