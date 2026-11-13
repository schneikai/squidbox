/**
 * The contract version (packages/shared/contracts/contractVersion.json, docs/sync-design.md §15) as
 * the scripts read and write it: the app sends it, the server requires it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATH = 'packages/shared/contracts/contractVersion.json';
export const CONTRACT_VERSION_FILE = fileURLToPath(new URL(`../${PATH}`, import.meta.url));

/** This checkout's contract version. */
export function contractVersion() {
  return JSON.parse(readFileSync(CONTRACT_VERSION_FILE, 'utf8')).version;
}

/** The contract version at `sha`; a commit from before the file reads as 1. */
export function contractVersionAt(sha) {
  let text;
  try {
    text = execFileSync('git', ['show', `${sha}:${PATH}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return 1;
  }
  return JSON.parse(text).version;
}

export function writeContractVersion(version) {
  writeFileSync(CONTRACT_VERSION_FILE, `${JSON.stringify({ version }, null, 1).replace(/\n\s*/g, ' ')}\n`);
}
