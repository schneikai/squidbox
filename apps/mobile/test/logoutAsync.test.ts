import { describe, it, expect, vi } from 'vitest';

const post = vi.fn();
vi.mock('../src/utils/cloud-api/api', () => ({ default: { post: (...args: unknown[]) => post(...args) } }));

const { default: logoutAsync } = await import('../src/utils/cloud-api/authentication/logoutAsync');

describe('logoutAsync', () => {
  it('revokes the refresh token it was given through the plain api', async () => {
    post.mockResolvedValue({ status: 204 });
    await logoutAsync('refresh-1');
    expect(post).toHaveBeenCalledWith('auth/logout', { refreshToken: 'refresh-1' });
  });

  it('is best effort: a failed revoke is not an error', async () => {
    post.mockRejectedValue(new Error('Network Error'));
    await expect(logoutAsync('refresh-1')).resolves.toBeUndefined();
  });
});
