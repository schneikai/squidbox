import { CLIENT_HEADER, CONTRACT_VERSION, formatClientInfo } from '@squidbox/shared';
import Constants from 'expo-constants';

import { getDeviceId } from './deviceId';

/**
 * The header that names this build to the server: its contract, commit and install
 * (docs/sync-design.md §15). Empty when the commit or the install's id isn't known (tests, a request
 * before the boot loaded it): the header never fails a request.
 */
export function clientHeader(): Record<string, string> {
  const build: unknown = Constants.expoConfig?.extra?.gitCommit;
  const device = getDeviceId();
  if (typeof build !== 'string' || !device) return {};
  return { [CLIENT_HEADER]: formatClientInfo({ contract: CONTRACT_VERSION, build, device }) };
}
