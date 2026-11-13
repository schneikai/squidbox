import contractVersion from './contractVersion.json';

// The header every app request names its build with: `<commit> <device> <version>`
// (docs/sync-design.md §15, The client header). Written by formatClientHeader, read by
// clientHeaderVersion.
export const CLIENT_HEADER = 'x-squidbox-client';

// The contract version: the app sends the one it was built with, the server refuses a build below the
// one it was deployed with (§15, The update gate). Changed only by `npm run contract:raise`.
export const CONTRACT_VERSION: number = contractVersion.version;

// The first contract version, which a request without a version (every build from before the gate,
// with or without the header) counts as. The scripts' copy: FIRST_CONTRACT_VERSION in
// scripts/contractVersion.mjs.
export const FIRST_CONTRACT_VERSION = 1;

// The status the server answers a build below its contract version with (§15, The update gate). Never
// changes: every build made from now on keys on it.
export const UPDATE_REQUIRED_STATUS = 426;

/** The header's value for a build: `-` for a commit or install id that isn't known. */
export function formatClientHeader(commit: string | null, device: string | null): string {
  return `${commit || '-'} ${device || '-'} ${CONTRACT_VERSION}`;
}

/**
 * The contract version a header names; FIRST_CONTRACT_VERSION when there is no header, or it names
 * none or not a positive integer.
 */
export function clientHeaderVersion(header: string | undefined): number {
  const version = Number(header?.trim().split(/\s+/)[2]);
  return Number.isInteger(version) && version > 0 ? version : FIRST_CONTRACT_VERSION;
}
