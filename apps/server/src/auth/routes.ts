import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  loginRequestSchema,
  loginResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  updateFeaturesRequestSchema,
  userResponseSchema,
} from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { findUserByEmail, switchUserFeature, toApiUser } from '../users.js';
import { verifyPassword } from './passwords.js';
import { signAccessToken } from './jwt.js';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from './tokens.js';
import { authenticate, requireFeature, requireUser } from './authenticate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const db = getDb();
  const { SERVER_ID: serverId } = loadConfig();

  // POST /auth/login
  r.route({
    method: 'POST',
    url: '/auth/login',
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: loginRequestSchema, response: { 200: loginResponseSchema } },
    handler: async (request) => {
      const { email, password } = request.body;
      const user = await findUserByEmail(db, email);
      if (!user || !(await verifyPassword(password, user.passwordDigest))) {
        throw AppError.invalidCredentials();
      }
      const accessToken = signAccessToken(user.id);
      const refreshToken = await issueRefreshToken(db, user.id);
      return { accessToken, refreshToken, user: toApiUser(user), serverId };
    },
  });

  // POST /auth/refresh — rotates only the presented token (per-device), with the grace of tokens.ts.
  r.route({
    method: 'POST',
    url: '/auth/refresh',
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { body: refreshRequestSchema, response: { 200: refreshResponseSchema } },
    handler: async (request) => {
      const { userId, token } = await rotateRefreshToken(db, request.body.refreshToken);
      const accessToken = signAccessToken(userId);
      return { accessToken, refreshToken: token };
    },
  });

  // POST /auth/logout — revoke this device's refresh token. 204.
  r.route({
    method: 'POST',
    url: '/auth/logout',
    schema: { body: refreshRequestSchema },
    handler: async (request, reply) => {
      await revokeRefreshToken(db, request.body.refreshToken);
      return reply.code(204).send();
    },
  });

  // GET /me
  r.route({
    method: 'GET',
    url: '/me',
    preHandler: authenticate(),
    schema: { response: { 200: userResponseSchema } },
    handler: async (request) => ({ user: toApiUser(requireUser(request)), serverId }),
  });

  // PATCH /me/features — a `developer` account switches one of its own other features
  // (Settings → Features), leaving the rest as they are. Only `npm run user:features` gives or takes
  // `developer` itself.
  r.route({
    method: 'PATCH',
    url: '/me/features',
    preHandler: [authenticate(), requireFeature('developer', AppError.developerOnly)],
    schema: { body: updateFeaturesRequestSchema, response: { 200: userResponseSchema } },
    handler: async (request) => {
      const { feature, isOn } = request.body;
      return { user: toApiUser(await switchUserFeature(db, requireUser(request).id, feature, isOn)), serverId };
    },
  });
}
