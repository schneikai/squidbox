#!/usr/bin/env node
/**
 * Raises the minimum contract version (docs/sync-design.md §15, Raising the minimum). Run it only on
 * the owner's decision, never on an agent's own: every installed build below the new version stops
 * syncing until it updates.
 *
 * In a clean checkout whose HEAD holds the breaking change and is the pushed tip of its branch (the
 * installed-build suite fetches the baseline's commit): rewrites apps/server/contract/baseline.json
 * to HEAD's commit and contract, then sets CONTRACT_VERSION to N + 1. It commits nothing; the next
 * steps are printed.
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
Next, in this order:
  1. Commit apps/server/contract/baseline.json and packages/shared/contracts/contractVersion.json and
     push ${branch}. Never rebase or force-push the branch after this: the baseline names ${commit.slice(0, 8)}.
  2. Publish the app from that commit on every channel: \`npm run ios:update\` (\`-- production\` too),
     or \`npm run ios:app\` when native code or the client migrations changed. Until the deploy below,
     that app runs against today's server.
  3. Then \`npm run deploy:server\`, which refuses until step 2 is done on every channel.`);
