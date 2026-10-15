import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from '../db/client.js';
import type { User } from '../db/schema.js';
import { AppError } from '../errors.js';
import { findUserById } from '../users.js';
import { verifyAccessToken } from './jwt.js';

// request.user is set by the authenticate preHandler on protected routes.
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && value) return value;
  return null;
}

/**
 * Auth preHandler factory. Standard `Authorization: Bearer <token>`. Loads the token's user once
 * per request; a token for a user that no longer exists is refused like a bad token.
 *
 * `allowQueryToken` is enabled ONLY for the upload route: iOS can drop the Authorization
 * header on background upload tasks (NSURLSessionUploadTask), so the client passes the token
 * as `?token=` there. Query strings are redacted from logs (see app.ts) so tokens don't leak.
 */
export function authenticate(opts: { allowQueryToken?: boolean } = {}) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    let token = bearer(request.headers.authorization);
    if (!token && opts.allowQueryToken) {
      const q = request.query as { token?: string } | undefined;
      if (q?.token) token = q.token;
    }
    if (!token) throw AppError.unauthorized('No authentication token provided');

    const { userId } = verifyAccessToken(token);
    const user = await findUserById(getDb(), userId);
    if (!user) throw AppError.unauthorized('Unknown user');
    request.user = user;
  };
}

export function requireUser(request: FastifyRequest): User {
  if (!request.user) throw AppError.unauthorized();
  return request.user;
}
