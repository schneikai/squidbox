import { CLIENT_HEADER, CONTRACT_VERSION } from '@squidbox/shared';
import Constants from 'expo-constants';

import { getDeviceId } from './deviceId';

/**
 * The header that names this build to the server: `<commit> <install id> <contract version>`
 * (docs/sync-design.md §15, The client header), `-` for a commit or install id that isn't known
 * (tests, a request before the boot loaded it), so every request names the contract version the
 * server's update gate reads.
 */
export function clientHeader(): Record<string, string> {
  const build: unknown = Constants.expoConfig?.extra?.gitCommit;
  const commit = typeof build === 'string' && build ? build : '-';
  return { [CLIENT_HEADER]: `${commit} ${getDeviceId() ?? '-'} ${CONTRACT_VERSION}` };
}
