import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  loginRequestSchema,
  loginResponseSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  userResponseSchema,
} from '@squidbox/shared';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { findUserByEmail, findUserById, toApiUser } from '../users.js';
import { verifyPassword } from './passwords.js';
import { signAccessToken } from './jwt.js';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from './tokens.js';
import { authenticate, requireUserId } from './authenticate.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const db = getDb();

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
      return { accessToken, refreshToken, user: toApiUser(user) };
    },
  });

  // POST /auth/refresh — rotates only the presented token (per-device).
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
    handler: async (request) => {
      const user = await findUserById(db, requireUserId(request));
      if (!user) throw AppError.notFound('User not found');
      return { user: toApiUser(user) };
    },
  });
}
