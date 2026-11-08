import { describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => new Map<string, string>());
const keychain = vi.hoisted(() => ({ fails: false }));
vi.mock('../src/utils/cloud-api/secureStorage', () => ({
  getItemAsync: async (key: string) => stored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    if (keychain.fails) throw new Error('keychain unavailable');
    stored.set(key, value);
  },
}));

const { getDeviceId, loadDeviceIdAsync } = await import('../src/utils/cloud-api/deviceId');

describe('deviceId', () => {
  it('stays unknown when it cannot be stored, so requests carry no header', async () => {
    keychain.fails = true;
    await expect(loadDeviceIdAsync()).rejects.toThrow('keychain unavailable');
    expect(getDeviceId()).toBeNull();
    keychain.fails = false;
  });

  it('is minted on the first launch and read back on the next', async () => {
    expect(getDeviceId()).toBeNull();
    await loadDeviceIdAsync();
    const minted = getDeviceId();
    expect(minted).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.get('deviceId')).toBe(minted);
    await loadDeviceIdAsync();
    expect(getDeviceId()).toBe(minted);
    expect(stored.size).toBe(1);
  });
});
