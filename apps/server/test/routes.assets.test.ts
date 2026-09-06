import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
vi.mock('../src/users.js', () => ({
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  toApiUser: (u: { id: string; email: string }) => ({ id: u.id, email: u.email }),
}));
vi.mock('../src/storage/s3.js', () => ({
  presignedDownloadUrl: vi.fn(),
  uploadStream: vi.fn(),
  deleteObject: vi.fn(),
}));

import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { findUserById } from '../src/users.js';
import { presignedDownloadUrl, uploadStream, deleteObject } from '../src/storage/s3.js';

const token = signAccessToken('u1');
const auth = { authorization: `Bearer ${token}` };

function asNewUser() {
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  asNewUser();
});

describe('POST /api/v1/assets/download-urls', () => {
  it('401 without auth', async () => {
    const res = await (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      payload: { keys: ['a.jpg'] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns presigned GET urls scoped to the user namespace', async () => {
    vi.mocked(presignedDownloadUrl).mockImplementation(async (_loc, key) => `https://s3/${key}`);
    const res = await (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      headers: auth,
      payload: { keys: ['a.jpg', 'b.jpg'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      urls: [
        { key: 'a.jpg', url: 'https://s3/a.jpg' },
        { key: 'b.jpg', url: 'https://s3/b.jpg' },
      ],
    });
    // new user ⇒ shared bucket + per-user prefix
    expect(presignedDownloadUrl).toHaveBeenCalledWith(
      { bucket: 'test-shared-bucket', keyPrefix: 'u/u1/' },
      'a.jpg',
      expect.any(Number)
    );
  });

  it('400 on empty keys', async () => {
    const res = await (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      headers: auth,
      payload: { keys: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('existing account uses its legacy bucket with empty prefix', async () => {
    vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: 'legacy' } as any);
    vi.mocked(presignedDownloadUrl).mockResolvedValue('https://s3/x');
    await (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      headers: auth,
      payload: { keys: ['x'] },
    });
    expect(presignedDownloadUrl).toHaveBeenCalledWith(
      { bucket: 'legacy', keyPrefix: '' },
      'x',
      expect.any(Number)
    );
  });
});

describe('PUT /api/v1/assets/upload/*', () => {
  it('streams an upload and returns the key (Bearer auth)', async () => {
    vi.mocked(uploadStream).mockResolvedValue();
    const res = await (await buildApp({ logger: false })).inject({
      method: 'PUT',
      url: '/api/v1/assets/upload/photo.jpg',
      headers: { ...auth, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ key: 'photo.jpg' });
    expect(uploadStream).toHaveBeenCalledWith(
      { bucket: 'test-shared-bucket', keyPrefix: 'u/u1/' },
      'photo.jpg',
      expect.anything(),
      'application/octet-stream'
    );
  });

  it('accepts the token via ?token= (iOS background-upload path)', async () => {
    vi.mocked(uploadStream).mockResolvedValue();
    const res = await (await buildApp({ logger: false })).inject({
      method: 'PUT',
      url: `/api/v1/assets/upload/photo.jpg?token=${token}`,
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(200);
  });

  it('401 without any token', async () => {
    const res = await (await buildApp({ logger: false })).inject({
      method: 'PUT',
      url: '/api/v1/assets/upload/photo.jpg',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/v1/assets/delete', () => {
  it('deletes keys and echoes them', async () => {
    vi.mocked(deleteObject).mockResolvedValue();
    const res = await (await buildApp({ logger: false })).inject({
      method: 'POST',
      url: '/api/v1/assets/delete',
      headers: auth,
      payload: { keys: ['a.jpg', 'b.jpg'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: ['a.jpg', 'b.jpg'] });
    expect(deleteObject).toHaveBeenCalledTimes(2);
  });
});
