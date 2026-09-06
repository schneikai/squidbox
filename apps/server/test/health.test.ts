import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/client.js', () => ({ getDb: () => ({}), closeDb: async () => {} }));

import { buildApp } from '../src/app.js';

describe('app basics', () => {
  it('GET /up returns ok', async () => {
    const res = await (await buildApp({ logger: false })).inject({ method: 'GET', url: '/up' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('unknown route returns the not_found envelope', async () => {
    const res = await (await buildApp({ logger: false })).inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
  });
});
