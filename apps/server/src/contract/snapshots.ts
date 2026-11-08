import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Contract } from './currentContract.js';

/**
 * Where each tagged build's contract is kept: `<tag without "build/">.json`, written by the ios-build
 * skill when it tags an App build (docs/sync-design.md §15), never rewritten.
 */
export const SNAPSHOTS_DIR = fileURLToPath(new URL('../../contract/builds/', import.meta.url));

/** Every tagged build's contract, oldest first (the file names sort like the tags). */
export function readSnapshots(): { tag: string; contract: Contract }[] {
  return readdirSync(SNAPSHOTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      tag: `build/${file.slice(0, -'.json'.length)}`,
      contract: JSON.parse(readFileSync(`${SNAPSHOTS_DIR}${file}`, 'utf8')) as Contract,
    }));
}
