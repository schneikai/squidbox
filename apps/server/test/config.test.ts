import { describe, it, expect, vi } from 'vitest';
import { loadConfig } from '../src/config.js';

// The config is cached at the first load: a test that loads its own env needs a fresh module.
async function freshLoadConfig() {
  vi.resetModules();
  return (await import('../src/config.js')).loadConfig;
}

describe('server config', () => {
  it('fails boot without SERVER_ID', async () => {
    const { SERVER_ID: _serverId, ...withoutServerId } = process.env;
    const load = await freshLoadConfig();
    expect(() => load(withoutServerId)).toThrow(/SERVER_ID is required/);
  });

  it('rejects a SERVER_ID that is not a uuid', async () => {
    const load = await freshLoadConfig();
    expect(() => load({ ...process.env, SERVER_ID: 'prod' })).toThrow(/SERVER_ID must be a uuid/);
  });

  it('boots without VENICE_API_KEY (the AI endpoints answer 503 instead)', () => {
    expect(process.env.VENICE_API_KEY).toBeUndefined();
    expect(loadConfig().VENICE_API_KEY).toBeUndefined();
  });

  it('takes an empty VENICE_API_KEY as unset', async () => {
    const load = await freshLoadConfig();
    const config = load({ ...process.env, VENICE_API_KEY: '' });
    expect(config.VENICE_API_KEY).toBeUndefined();
  });

  it('defaults VENICE_BASE_URL to Venice', () => {
    expect(loadConfig().VENICE_BASE_URL).toBe('https://api.venice.ai/api/v1');
  });
});
