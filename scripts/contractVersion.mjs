/**
 * The contract version (packages/shared/contracts/contractVersion.json, docs/sync-design.md §15) as
 * the scripts read and write it: the app sends it, the server requires it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATH = 'packages/shared/contracts/contractVersion.json';

// The first contract version, which every commit from before the file holds. The app and server's
// copy: FIRST_CONTRACT_VERSION in packages/shared/contracts/client.ts.
export const FIRST_CONTRACT_VERSION = 1;
const FILE = fileURLToPath(new URL(`../${PATH}`, import.meta.url));

/** This checkout's contract version. */
export function contractVersion() {
  return JSON.parse(readFileSync(FILE, 'utf8')).version;
}

/** The contract version at `sha`; a commit from before the file reads as the first. */
export function contractVersionAt(sha) {
  let text;
  try {
    text = execFileSync('git', ['show', `${sha}:${PATH}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return FIRST_CONTRACT_VERSION;
  }
  return JSON.parse(text).version;
}

export function writeContractVersion(version) {
  writeFileSync(FILE, `{ "version": ${version} }\n`);
}
