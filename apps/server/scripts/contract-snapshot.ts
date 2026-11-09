/**
 * Writes the contract of the App build made from this checkout's commit (docs/sync-design.md §15):
 * today's routes, collections, error envelope and client migrations, with the commit and the build
 * date, to contract/builds/<YYYYMMDD>-<short sha>.json, which test/contract.test.ts holds today's
 * server to. The ios-build skill runs it right after a build, in the clean checkout it built; a
 * build's contract never changes, so an existing file is refused.
 *
 * Run from apps/server: npm run contract:snapshot
 */
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain') !== '') {
  console.error('The checkout has changes: snapshot the clean commit the build was made from.');
  process.exit(1);
}
setThrowawayEnv();
const { currentContract } = await import('../src/contract/currentContract.js');
const { snapshotFile } = await import('../src/contract/snapshots.js');

const build = { commit: git('rev-parse', 'HEAD'), builtAt: new Date().toISOString().slice(0, 10) };
const file = snapshotFile(build);
if (existsSync(file)) {
  console.error(`${file} exists: a build's contract never changes.`);
  process.exit(1);
}
writeFileSync(file, `${JSON.stringify({ ...build, contract: await currentContract() }, null, 1)}\n`);
console.log(`Wrote the contract of the build of ${build.commit}: ${file}`);
