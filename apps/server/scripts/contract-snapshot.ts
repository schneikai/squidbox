/**
 * Writes the contract of the build tagged `<tag>` (docs/sync-design.md §15): today's routes,
 * collections, error envelope and client migrations, to contract/builds/<tag without "build/">.json,
 * which test/contract.test.ts holds today's server to. The ios-build skill runs it right after it
 * tags an App build; a build's contract never changes, so an existing file is refused.
 *
 * Run from apps/server: npm run contract:snapshot -- build/20261023-b8171cf9
 */
import { existsSync, writeFileSync } from 'node:fs';
import { setThrowawayEnv } from '../src/throwawayEnv.js';

const [tag] = process.argv.slice(2);
if (!tag?.startsWith('build/') || tag.length === 'build/'.length) {
  console.error('Usage: npm run contract:snapshot -- build/<YYYYMMDD>-<short sha>');
  process.exit(1);
}
setThrowawayEnv();
const { currentContract } = await import('../src/contract/currentContract.js');
const { snapshotFile } = await import('../src/contract/snapshots.js');

const file = snapshotFile(tag);
if (existsSync(file)) {
  console.error(`${file} exists: a build's contract never changes.`);
  process.exit(1);
}
writeFileSync(file, `${JSON.stringify(await currentContract(), null, 1)}\n`);
console.log(`Wrote the contract of ${tag}: ${file}`);
