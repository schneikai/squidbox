import contractVersion from './contractVersion.json';

// The header every request names its build with (docs/sync-design.md §15, The client header):
// `<commit> <device> <version>`, the git sha the build was made from, the install's id (`-` for an
// unknown commit or device) and the build's CONTRACT_VERSION (apps/mobile/src/utils/cloud-api/clientHeader.ts
// writes it, apps/server/src/plugins/clientVersion.ts reads it).
export const CLIENT_HEADER = 'x-squidbox-client';

// The contract version: the app sends the one it was built with, the server refuses a build below the
// one it was deployed with (§15, The update gate). Changed only by `npm run contract:raise`.
export const CONTRACT_VERSION: number = contractVersion.version;

// The status the server answers a build below its contract version with, and on which the app shows
// "Update Squidbox to keep syncing". Never changes: every build made from now on keys on it.
export const UPDATE_REQUIRED_STATUS = 426;
