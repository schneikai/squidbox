import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken, ACCESS_TOKEN_TTL_SECONDS } from '../src/auth/jwt.js';
import { AppError } from '../src/errors.js';

const SECRET = process.env.JWT_SECRET as string;

describe('access token JWT', () => {
  it('round-trips a userId', () => {
    const token = signAccessToken('user-123');
    expect(verifyAccessToken(token)).toEqual({ userId: 'user-123' });
  });

  it('payload is exactly { user_id, exp } (HS256, no iat/sub/jti)', () => {
    const now = 1_700_000_000_000;
    const token = signAccessToken('u1', now);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual(['exp', 'user_id']);
    expect(decoded.user_id).toBe('u1');
    expect(decoded.exp).toBe(Math.floor(now / 1000) + ACCESS_TOKEN_TTL_SECONDS);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    expect(header.alg).toBe('HS256');
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken('u1');
    expect(() => verifyAccessToken(token + 'x')).toThrow(AppError);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ user_id: 'u1', exp: 1 }, SECRET, {
      algorithm: 'HS256',
      noTimestamp: true,
    });
    expect(() => verifyAccessToken(expired)).toThrow(/Invalid or expired/);
  });

  it('rejects the alg:none downgrade attack', () => {
    const none = jwt.sign({ user_id: 'u1', exp: 9_999_999_999 }, '', { algorithm: 'none' });
    expect(() => verifyAccessToken(none)).toThrow(AppError);
  });

  it('rejects a token signed with a different secret', () => {
    const other = jwt.sign({ user_id: 'u1', exp: 9_999_999_999 }, 'wrong-secret', {
      algorithm: 'HS256',
      noTimestamp: true,
    });
    expect(() => verifyAccessToken(other)).toThrow(AppError);
  });
});
