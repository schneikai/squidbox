import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  toApiUser: (u: { id: string; email: string }) => ({ id: u.id, email: u.email }),
}));
vi.mock('../src/auth/passwords.js', () => ({ verifyPassword: vi.fn(), hashPassword: vi.fn() }));
vi.mock('../src/auth/tokens.js', () => ({
  issueRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));

import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { findUserByEmail, findUserById } from '../src/users.js';
import { verifyPassword } from '../src/auth/passwords.js';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../src/auth/tokens.js';

const user = { id: 'u1', email: 'a@b.co', passwordDigest: 'digest', storageBucket: null };

async function app() {
  return buildApp({ logger: false });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens + user on valid credentials', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(user as any);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(issueRefreshToken).mockResolvedValue('refresh-1');

    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'a@b.co', password: 'pw' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.refreshToken).toBe('refresh-1');
    expect(body.user).toEqual({ id: 'u1', email: 'a@b.co' });
    expect(typeof body.accessToken).toBe('string');
  });

  it('401 invalid_credentials on wrong password', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(user as any);
    vi.mocked(verifyPassword).mockResolvedValue(false);
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'a@b.co', password: 'bad' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: 'invalid_credentials', message: expect.any(String) } });
  });

  it('401 invalid_credentials on unknown email', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(undefined);
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nope@b.co', password: 'pw' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('400 validation_error on malformed body', async () => {
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'a@b.co' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('validation_error');
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates and returns new tokens, no user field', async () => {
    vi.mocked(rotateRefreshToken).mockResolvedValue({ userId: 'u1', token: 'refresh-2' });
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'refresh-1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.refreshToken).toBe('refresh-2');
    expect(typeof body.accessToken).toBe('string');
    expect(body.user).toBeUndefined();
  });

  it('401 on invalid refresh token', async () => {
    const { AppError } = await import('../src/errors.js');
    vi.mocked(rotateRefreshToken).mockRejectedValue(AppError.invalidToken());
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'bad' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('invalid_token');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the presented token and returns 204', async () => {
    vi.mocked(revokeRefreshToken).mockResolvedValue();
    const res = await (await app()).inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken: 'refresh-1' },
    });
    expect(res.statusCode).toBe(204);
    expect(revokeRefreshToken).toHaveBeenCalledWith(expect.anything(), 'refresh-1');
  });
});

describe('GET /api/v1/me', () => {
  it('401 without a token', async () => {
    const res = await (await app()).inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthorized');
  });

  it('returns the user with a valid token', async () => {
    vi.mocked(findUserById).mockResolvedValue(user as any);
    const token = signAccessToken('u1');
    const res = await (await app()).inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ user: { id: 'u1', email: 'a@b.co' } });
  });
});
