/**
 * Writes the contract of the App at this checkout's commit (docs/sync-design.md §15): today's
 * routes, collections, error envelope and client migrations, with the commit, to
 * contract/baseline.json, which test/contract.test.ts holds today's server to. It overwrites the
 * baseline in place.
 *
 * Run only by `npm run contract:raise` (scripts/raiseContract.mjs), which checks the checkout is clean
 * and pushed and raises the contract version with it: a baseline rewritten without the raise would
 * let installed builds break.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
setThrowawayEnv();
const { currentContract } = await import('../src/contract/currentContract.js');
const { BASELINE_FILE } = await import('../src/contract/baseline.js');

const commit = git('rev-parse', 'HEAD');
writeFileSync(BASELINE_FILE, `${JSON.stringify({ commit, contract: await currentContract() }, null, 1)}\n`);
console.log(`Wrote the contract of the App at ${commit}: ${BASELINE_FILE}`);
