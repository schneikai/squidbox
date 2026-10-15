import { describe, it, expect } from 'vitest';
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
});
