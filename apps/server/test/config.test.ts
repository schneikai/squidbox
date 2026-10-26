import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('server config', () => {
  it('fails boot without SERVER_ID', () => {
    const { SERVER_ID: _serverId, ...withoutServerId } = process.env;
    expect(() => loadConfig(withoutServerId)).toThrow(/SERVER_ID is required/);
  });

  it('rejects a SERVER_ID that is not a uuid', () => {
    expect(() => loadConfig({ ...process.env, SERVER_ID: 'prod' })).toThrow(/SERVER_ID must be a uuid/);
  });

  it('loads the test env', () => {
    expect(loadConfig().SERVER_ID).toBe(process.env.SERVER_ID);
  });

  it('boots without VENICE_API_KEY (the AI endpoints answer 503 instead)', () => {
    expect(process.env.VENICE_API_KEY).toBeUndefined();
    expect(loadConfig().VENICE_API_KEY).toBeUndefined();
  });

  it('takes an empty VENICE_API_KEY as unset', async () => {
    vi.resetModules(); // a fresh, uncached config
    const { loadConfig: loadFresh } = await import('../src/config.js');
    const config = loadFresh({ ...process.env, VENICE_API_KEY: '' });
    expect(config.VENICE_API_KEY).toBeUndefined();
  });

  it('defaults VENICE_BASE_URL to Venice', () => {
    expect(loadConfig().VENICE_BASE_URL).toBe('https://api.venice.ai/api/v1');
  });
});
