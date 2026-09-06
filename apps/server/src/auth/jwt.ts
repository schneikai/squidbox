import jwt from 'jsonwebtoken';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';

// Access token: HS256, payload exactly { user_id, exp }, signed with the shared Rails
// secret_key_base. Keeping HS256 + the same secret means existing Rails-issued access tokens
// still validate at cutover (refresh tokens are handled separately via the per-device table).
export const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24h

interface AccessTokenPayload {
  user_id: string;
  exp: number;
}

export function signAccessToken(userId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ACCESS_TOKEN_TTL_SECONDS;
  const payload: AccessTokenPayload = { user_id: userId, exp };
  // exp is already in the payload; do not let jsonwebtoken add its own.
  return jwt.sign(payload, loadConfig().JWT_SECRET, { algorithm: 'HS256', noTimestamp: true });
}

export function verifyAccessToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, loadConfig().JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded === 'string' || typeof decoded.user_id !== 'string') {
      throw AppError.invalidToken();
    }
    return { userId: decoded.user_id };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.invalidToken();
  }
}
