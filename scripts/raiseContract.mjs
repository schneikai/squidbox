#!/usr/bin/env node
/**
 * Raises the minimum contract version: docs/sync-design.md §15, Raising the minimum, step 1 (whose
 * decision it is: CLAUDE.md). Rewrites apps/server/contract/baseline.json to HEAD's commit and
 * contract and sets CONTRACT_VERSION to N + 1; commits nothing.
 *
 *   npm run contract:raise
 */
import { fileURLToPath } from 'node:url';
import { contractVersion, writeContractVersion } from './contractVersion.mjs';
import { fail, requirePushedTip, run } from './ship.mjs';

const { branch, commit } = requirePushedTip();
const server = fileURLToPath(new URL('../apps/server', import.meta.url));
if (!run('node', ['--import', 'tsx', 'scripts/contract-baseline.ts'], server)) fail('Writing the baseline failed.');
const version = contractVersion() + 1;
writeContractVersion(version);

console.log(`
Raised the contract version to ${version}; the baseline is the contract of ${commit.slice(0, 8)}.
Commit both files and push ${branch}, then follow docs/sync-design.md §15, Raising the minimum, from step 2.`);
