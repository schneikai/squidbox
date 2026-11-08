import { CONTRACT_VERSION } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ extra: {} as { gitCommit?: string } }));
const device = vi.hoisted(() => ({ id: null as string | null }));
vi.mock('expo-constants', () => ({ default: { expoConfig: config } }));
vi.mock('../src/utils/cloud-api/deviceId', () => ({ getDeviceId: () => device.id }));

const { clientHeader } = await import('../src/utils/cloud-api/clientHeader');

const COMMIT = 'b8171cf94f0e681b1b1e1489755730698a95789c';
const DEVICE = '3f2c1a0e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

describe('clientHeader', () => {
  it("names the build's contract, commit and install", () => {
    config.extra = { gitCommit: COMMIT };
    device.id = DEVICE;
    expect(clientHeader()).toEqual({ 'x-squidbox-client': `${CONTRACT_VERSION} ${COMMIT} ${DEVICE}` });
  });

  it.each([
    ['the commit', { gitCommit: undefined }, DEVICE],
    ["the install's id", { gitCommit: COMMIT }, null],
  ])('is empty without %s', (_, extra, id) => {
    config.extra = extra;
    device.id = id;
    expect(clientHeader()).toEqual({});
  });
});
