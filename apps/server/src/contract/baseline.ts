import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Contract } from './currentContract.js';

/**
 * The contract of the oldest supported build (docs/sync-design.md §15, The baseline), which
 * test/contract.test.ts holds today's server to. Rewritten only by `npm run contract:raise`.
 */
export const BASELINE_FILE = fileURLToPath(new URL('../../contract/baseline.json', import.meta.url));

/** The oldest supported build: the commit it was built from (full sha) and its contract. */
export type Baseline = { commit: string; contract: Contract };

/** The baseline; a missing or unparsable file throws. */
export const readBaseline = (): Baseline => JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
