import { describe, expect, it, vi } from 'vitest';

const stored = vi.hoisted(() => new Map<string, string>());
vi.mock('../src/utils/cloud-api/secureStorage', () => ({
  getItemAsync: async (key: string) => stored.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void stored.set(key, value),
}));

const { getDeviceId, loadDeviceIdAsync } = await import('../src/utils/cloud-api/deviceId');

describe('deviceId', () => {
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
