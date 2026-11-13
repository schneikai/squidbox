import { CLIENT_HEADER, UPDATE_REQUIRED_STATUS } from '@squidbox/shared';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));
// This server needs contract version 2, as after a raise.
vi.mock('@squidbox/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@squidbox/shared')>()),
  CONTRACT_VERSION: 2,
}));

import { buildApp } from '../src/app.js';

const COMMIT = 'b8171cf94f0e681b1b1e1489755730698a95789c';
const DEVICE = '3f2c1a0e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

async function request(url: string, header?: string) {
  const app = await buildApp({ logger: false });
  return app.inject({
    method: url === '/up' ? 'GET' : 'POST',
    url,
    headers: header === undefined ? {} : { [CLIENT_HEADER]: header },
    payload: url === '/up' ? undefined : {},
  });
}

describe('the update gate', () => {
  it('answers a build below the server’s contract version with 426 and the envelope, on any API route', async () => {
    for (const url of ['/api/v1/auth/login', '/api/v1/sync/push', '/api/v1/auth/refresh']) {
      const res = await request(url, `${COMMIT} ${DEVICE} 1`);
      expect(res.statusCode, url).toBe(UPDATE_REQUIRED_STATUS);
      expect(res.json(), url).toEqual({
        error: { code: 'update_required', message: 'This build speaks contract version 1; the server needs 2' },
      });
    }
  });

  it.each([
    ['without a version (a build from before the gate)', `${COMMIT} ${DEVICE}`],
    ['with a version that is not a positive integer', `${COMMIT} ${DEVICE} two`],
  ])('counts a header %s as version 1', async (_, header) => {
    expect((await request('/api/v1/auth/login', header)).statusCode).toBe(UPDATE_REQUIRED_STATUS);
  });

  it('lets a build at the server’s contract version through', async () => {
    expect((await request('/api/v1/auth/login', `- - 2`)).statusCode).toBe(400);
  });

  it('lets a request without the header through: it is not the app', async () => {
    expect((await request('/api/v1/auth/login')).statusCode).toBe(400);
  });

  it('never gates /up', async () => {
    const res = await request('/up', `${COMMIT} ${DEVICE} 1`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ minContractVersion: 2 });
  });
});
