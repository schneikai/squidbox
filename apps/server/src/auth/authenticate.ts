import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors.js';
import { verifyAccessToken } from './jwt.js';

// request.userId is set by the authenticate preHandler on protected routes.
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() === 'bearer' && value) return value;
  return null;
}

/**
 * Auth preHandler factory. Standard `Authorization: Bearer <token>`.
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
    request.userId = userId;
  };
}

export function requireUserId(request: FastifyRequest): string {
  if (!request.userId) throw AppError.unauthorized();
  return request.userId;
}
