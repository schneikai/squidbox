import { CLIENT_HEADER, formatClientHeader } from '@squidbox/shared';
import Constants from 'expo-constants';

import { getDeviceId } from './deviceId';

/** The header that names this build to the server (formatClientHeader, docs/sync-design.md §15). */
export function clientHeader(): Record<string, string> {
  const build: unknown = Constants.expoConfig?.extra?.gitCommit;
  return { [CLIENT_HEADER]: formatClientHeader(typeof build === 'string' ? build : null, getDeviceId()) };
}
