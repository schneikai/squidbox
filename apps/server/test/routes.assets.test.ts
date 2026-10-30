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
  deleteObjects: vi.fn(),
}));
vi.mock('../src/sync/purgedFiles.js', () => ({ isPurgedFileKey: vi.fn() }));

import { DELETE_KEYS_MAX } from '@squidbox/shared';
import { buildApp } from '../src/app.js';
import { signAccessToken } from '../src/auth/jwt.js';
import { findUserById } from '../src/users.js';
import { presignedDownloadUrl, uploadStream, deleteObjects } from '../src/storage/s3.js';
import { isPurgedFileKey } from '../src/sync/purgedFiles.js';

const token = signAccessToken('u1');
const auth = { authorization: `Bearer ${token}` };

function asNewUser() {
  vi.mocked(findUserById).mockResolvedValue({ id: 'u1', email: 'a@b.co', storageBucket: null } as any);
}

beforeEach(() => {
  asNewUser();
});

describe('POST /api/v1/assets/download-urls', () => {
  it('401 without auth', async () => {
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      payload: { keys: ['a.jpg'] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns presigned GET urls scoped to the user namespace', async () => {
    vi.mocked(presignedDownloadUrl).mockImplementation(async (_loc, key) => `https://s3/${key}`);
    const res = await (
      await buildApp({ logger: false })
    ).inject({
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
      expect.any(Number),
    );
  });

  it('400 on empty keys', async () => {
    const res = await (
      await buildApp({ logger: false })
    ).inject({
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
    await (
      await buildApp({ logger: false })
    ).inject({
      method: 'POST',
      url: '/api/v1/assets/download-urls',
      headers: auth,
      payload: { keys: ['x'] },
    });
    expect(presignedDownloadUrl).toHaveBeenCalledWith({ bucket: 'legacy', keyPrefix: '' }, 'x', expect.any(Number));
  });
});

describe('PUT /api/v1/assets/upload/*', () => {
  it('streams an upload and returns the key (Bearer auth)', async () => {
    vi.mocked(uploadStream).mockResolvedValue();
    const res = await (
      await buildApp({ logger: false })
    ).inject({
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
      'application/octet-stream',
    );
  });

  it.each(['text/plain', 'application/json', 'image/jpeg'])('streams the full body for %s uploads', async (type) => {
    let received = '';
    vi.mocked(uploadStream).mockImplementation(async (_loc, _key, body) => {
      for await (const chunk of body) received += chunk;
    });
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'PUT',
      url: '/api/v1/assets/upload/note.txt',
      headers: { ...auth, 'content-type': type },
      payload: '{"hello":"world"}',
    });
    expect(res.statusCode).toBe(200);
    expect(received).toBe('{"hello":"world"}');
  });

  it('accepts the token via ?token= (iOS background-upload path)', async () => {
    vi.mocked(uploadStream).mockResolvedValue();
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'PUT',
      url: `/api/v1/assets/upload/photo.jpg?token=${token}`,
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(200);
  });

  it('410 before reading the body when the asset is purged', async () => {
    vi.mocked(isPurgedFileKey).mockResolvedValueOnce(true);
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'PUT',
      url: '/api/v1/assets/upload/photo.jpg',
      headers: { ...auth, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(410);
    expect(isPurgedFileKey).toHaveBeenCalledWith(expect.anything(), 'u1', 'photo.jpg');
    expect(uploadStream).not.toHaveBeenCalled();
    expect(deleteObjects).not.toHaveBeenCalled();
  });

  it('410 and the file deleted again when the purge landed during the upload', async () => {
    vi.mocked(uploadStream).mockResolvedValue();
    vi.mocked(deleteObjects).mockResolvedValue([]);
    vi.mocked(isPurgedFileKey).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'PUT',
      url: '/api/v1/assets/upload/photo.jpg',
      headers: { ...auth, 'content-type': 'application/octet-stream' },
      payload: Buffer.from('hello'),
    });
    expect(res.statusCode).toBe(410);
    expect(uploadStream).toHaveBeenCalled();
    expect(deleteObjects).toHaveBeenCalledWith({ bucket: 'test-shared-bucket', keyPrefix: 'u/u1/' }, ['photo.jpg']);
  });

  it('401 without any token', async () => {
    const res = await (
      await buildApp({ logger: false })
    ).inject({
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
    vi.mocked(deleteObjects).mockResolvedValue([]);
    const res = await (
      await buildApp({ logger: false })
    ).inject({
      method: 'POST',
      url: '/api/v1/assets/delete',
      headers: auth,
      payload: { keys: ['a.jpg', 'b.jpg'] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: ['a.jpg', 'b.jpg'] });
    // One request, only ever in the caller's own namespace, derived from the token.
    expect(deleteObjects).toHaveBeenCalledTimes(1);
    expect(deleteObjects).toHaveBeenCalledWith({ bucket: 'test-shared-bucket', keyPrefix: 'u/u1/' }, [
      'a.jpg',
      'b.jpg',
    ]);
  });

  it('401 without auth, 400 for more keys than one request takes', async () => {
    const app = await buildApp({ logger: false });
    const unauthenticated = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/delete',
      payload: { keys: ['a'] },
    });
    expect(unauthenticated.statusCode).toBe(401);
    const tooMany = await app.inject({
      method: 'POST',
      url: '/api/v1/assets/delete',
      headers: auth,
      payload: { keys: Array.from({ length: DELETE_KEYS_MAX + 1 }, (_, i) => `${i}.jpg`) },
    });
    expect(tooMany.statusCode).toBe(400);
    expect(deleteObjects).not.toHaveBeenCalled();
  });
});
