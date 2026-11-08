/**
 * Records the API and sync contract when it changed (docs/sync-design.md §15): today's contract is
 * written as the next file in contract/history and its number to CONTRACT_VERSION in
 * packages/shared/contracts/version.ts, unless an installed build (a kept history file) couldn't
 * work against it: then the problems are printed and nothing is written.
 *
 * Run from the repo root (it records the sample client database too): npm run contract:record
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

setThrowawayEnv();
const { CONTRACT_VERSION } = await import('@squidbox/shared');
const { currentContract } = await import('../src/contract/currentContract.js');
const { problems } = await import('../src/contract/compatibility.js');
const { HISTORY_DIR, readHistory } = await import('../src/contract/history.js');

const VERSION_FILE = fileURLToPath(new URL('../../../packages/shared/contracts/version.ts', import.meta.url));

const history = readHistory();
const current = await currentContract();
const newest = history.at(-1);
if (newest && JSON.stringify(newest.contract) === JSON.stringify(current)) {
  console.log(`The contract is unchanged: version ${newest.version}.`);
  process.exit(0);
}
const found = history.flatMap(({ version, contract }) =>
  problems(contract, current).map((problem) => `version ${version}: ${problem}`),
);
if (found.length > 0) {
  console.error(`An installed build couldn't work against this change:\n${found.join('\n')}`);
  process.exit(1);
}
// After retired versions' files were deleted, the numbers go on from the highest kept one.
const next = (newest?.version ?? CONTRACT_VERSION) + 1;
const file = `${HISTORY_DIR}${String(next).padStart(4, '0')}.json`;
writeFileSync(file, `${JSON.stringify(current, null, 1)}\n`);
writeFileSync(
  VERSION_FILE,
  `// The number of the API and sync contract this code speaks: the newest file in
// apps/server/contract/history (docs/sync-design.md §15). Written by \`npm run contract:record\`.
export const CONTRACT_VERSION = ${next};
`,
);
console.log(`Recorded contract version ${next}: ${file}`);
