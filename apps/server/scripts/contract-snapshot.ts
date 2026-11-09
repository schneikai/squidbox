/**
 * Writes the contract of the App build made from this checkout's commit (docs/sync-design.md §15):
 * today's routes, collections, error envelope and client migrations, with the commit and the build
 * date, to contract/builds/<YYYYMMDD>-<short sha>.json, which test/contract.test.ts holds today's
 * server to. `npm run ios:app` (scripts/iosAppBuild.mjs) runs it before each App build, in the clean
 * checkout it builds; a build's contract never changes, so a commit's second snapshot is refused.
 *
 * Run from apps/server: npm run contract:snapshot
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain') !== '') {
  console.error('The checkout has changes: snapshot the clean commit the build was made from.');
  process.exit(1);
}
setThrowawayEnv();
const { currentContract } = await import('../src/contract/currentContract.js');
const { SNAPSHOTS_DIR, snapshotFile } = await import('../src/contract/snapshots.js');

const build = { commit: git('rev-parse', 'HEAD'), builtAt: new Date().toISOString().slice(0, 10) };
const file = snapshotFile(build);
const existing = readdirSync(SNAPSHOTS_DIR).find((name) => name.endsWith(`-${build.commit.slice(0, 8)}.json`));
if (existing) {
  console.error(`${existing} exists: a build's contract never changes.`);
  process.exit(1);
}
writeFileSync(file, `${JSON.stringify({ ...build, contract: await currentContract() }, null, 1)}\n`);
console.log(`Wrote the contract of the build of ${build.commit}: ${file}`);
