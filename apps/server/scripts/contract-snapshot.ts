/**
 * Writes the contract of the App at this checkout's commit (docs/sync-design.md §15): today's
 * routes, collections, error envelope and client migrations, with the commit and the date, to
 * contract/builds/<YYYYMMDD>-<short sha>.json, which test/contract.test.ts holds today's server to.
 * It is written before each App build or update ships, in the clean checkout it ships; a
 * commit that has its snapshot already keeps it, as its contract never changes.
 *
 * Run from apps/server: npm run contract:snapshot
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain') !== '') {
  console.error('The checkout has changes: snapshot the clean commit the App ships from.');
  process.exit(1);
}
setThrowawayEnv();
const { currentContract } = await import('../src/contract/currentContract.js');
const { findSnapshot, snapshotFile } = await import('../src/contract/snapshots.js');

const build = { commit: git('rev-parse', 'HEAD'), builtAt: new Date().toISOString().slice(0, 10) };
const file = snapshotFile(build);
if (findSnapshot(build.commit)) {
  console.log(`${build.commit} has its snapshot already: the App's contract at a commit never changes.`);
  process.exit(0);
}
writeFileSync(file, `${JSON.stringify({ ...build, contract: await currentContract() }, null, 1)}\n`);
console.log(`Wrote the contract of the App at ${build.commit}: ${file}`);
