import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Contract } from './currentContract.js';

/**
 * Where the contract of each App build and update is kept, one `<YYYYMMDD>-<short sha>.json` per
 * commit, written by `npm run ios:app` or `npm run ios:update` before it ships (docs/sync-design.md
 * §15), never rewritten.
 */
export const SNAPSHOTS_DIR = fileURLToPath(new URL('../../contract/builds/', import.meta.url));

/** A build's snapshot: the commit it was built from (full sha), its build date, its contract. */
export type Snapshot = { commit: string; builtAt: string; contract: Contract };

/** The snapshot file of a build from `commit` on `builtAt` (YYYY-MM-DD). */
export const snapshotFile = ({ commit, builtAt }: Omit<Snapshot, 'contract'>) =>
  `${SNAPSHOTS_DIR}${builtAt.replaceAll('-', '')}-${commit.slice(0, 8)}.json`;

/** Every build's snapshot, oldest build first. */
export function readSnapshots(): Snapshot[] {
  return readdirSync(SNAPSHOTS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => JSON.parse(readFileSync(`${SNAPSHOTS_DIR}${file}`, 'utf8')) as Snapshot);
}

/** The snapshot of a build from `commit`, if one was written. */
export const findSnapshot = (commit: string) => readSnapshots().find((snapshot) => snapshot.commit === commit);
