import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Contract } from './currentContract.js';

/** Where the recorded contracts live, one `<NNNN>.json` per contract change (docs/sync-design.md §15). */
export const HISTORY_DIR = fileURLToPath(new URL('../../contract/history/', import.meta.url));

/** The recorded contracts still kept, oldest first. */
export function readHistory(): { version: number; contract: Contract }[] {
  return readdirSync(HISTORY_DIR)
    .filter((file) => /^\d{4}\.json$/.test(file))
    .sort()
    .map((file) => ({
      version: Number(file.slice(0, 4)),
      contract: JSON.parse(readFileSync(`${HISTORY_DIR}${file}`, 'utf8')) as Contract,
    }));
}
