import { CLIENT_HEADER, CONTRACT_VERSION } from '@squidbox/shared';
import { describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ extra: {} as { gitCommit?: string } }));
const device = vi.hoisted(() => ({ id: null as string | null }));
vi.mock('expo-constants', () => ({ default: { expoConfig: config } }));
vi.mock('../src/utils/cloud-api/deviceId', () => ({ getDeviceId: () => device.id }));

const { clientHeader } = await import('../src/utils/cloud-api/clientHeader');

const COMMIT = 'b8171cf94f0e681b1b1e1489755730698a95789c';
const DEVICE = '3f2c1a0e-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

describe('clientHeader', () => {
  it("names the build's commit, install and contract version", () => {
    config.extra = { gitCommit: COMMIT };
    device.id = DEVICE;
    expect(clientHeader()).toEqual({ [CLIENT_HEADER]: `${COMMIT} ${DEVICE} ${CONTRACT_VERSION}` });
  });

  it.each([
    ['the commit', { gitCommit: undefined }, DEVICE, `- ${DEVICE} ${CONTRACT_VERSION}`],
    ["the install's id", { gitCommit: COMMIT }, null, `${COMMIT} - ${CONTRACT_VERSION}`],
  ])('names the contract version without %s', (_, extra, id, header) => {
    config.extra = extra;
    device.id = id;
    expect(clientHeader()).toEqual({ [CLIENT_HEADER]: header });
  });
});
