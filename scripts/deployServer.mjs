#!/usr/bin/env node
/**
 * Deploys the server (apps/server) to Fly.io, the one way to deploy (deploy-server skill), refusing a
 * server that raises the minimum contract version too early (scripts/deployCheck.mjs).
 *
 *   npm run deploy:server                                  # builds on Fly with apps/server/Dockerfile
 *   npm run deploy:server -- --image <tag> --local-only    # a locally built image (cloud workspace)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractVersion, contractVersionAt, FIRST_CONTRACT_VERSION } from './contractVersion.mjs';
import { deployRefusals } from './deployCheck.mjs';
import {
  eas,
  easProfiles,
  fail,
  finishedBuilds,
  flyCli,
  hasCommit,
  latestUpdateFor,
  latestUpdates,
  run,
} from './ship.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const mobileDir = join(root, 'apps/mobile');
const FLY_CONFIG = 'apps/server/fly.toml';

const version = contractVersion();
const refusals = deployRefusals({
  version,
  liveMinimum: version === FIRST_CONTRACT_VERSION ? null : await readLiveMinimum(),
  channels: readChannels,
  versionAt: (commit) => (hasCommit(commit) ? contractVersionAt(commit) : null),
});
if (refusals.length > 0) fail(refusals.join('\n'));

const extra = process.argv.slice(2);
const args = [
  'deploy',
  '.',
  '--config',
  FLY_CONFIG,
  ...(extra.length > 0 ? extra : ['--dockerfile', 'apps/server/Dockerfile']),
];
if (!run(flyCli(), args, root)) fail('fly deploy failed.');

// The deployed server's minimum contract version (`/up`; a server from before the gate has none: the
// first), or null when it can't be read: a server that is down must stay deployable.
async function readLiveMinimum() {
  const app = /^app\s*=\s*['"]([^'"]+)['"]/m.exec(readFileSync(join(root, FLY_CONFIG), 'utf8'))?.[1];
  try {
    const response = await fetch(`https://${app}.fly.dev/up`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    return (await response.json()).minContractVersion ?? FIRST_CONTRACT_VERSION;
  } catch {
    return null;
  }
}

// Per channel in eas.json, its latest finished iOS build and the latest update for that build's
// runtime; null when EAS can't be read (checked once first, so an unreadable EAS refuses at once
// instead of after the retries).
function readChannels() {
  if (!run(eas, ['whoami'], mobileDir)) return null;
  const names = [
    ...new Set(
      Object.values(easProfiles())
        .map(({ channel }) => channel)
        .filter(Boolean),
    ),
  ];
  const branches = latestUpdates(mobileDir);
  return names.map((name) => {
    const [build] = finishedBuilds(['--platform', 'ios', '--channel', name, '--limit', '1'], mobileDir);
    const runtime = build?.runtime?.version;
    const update = runtime && branches.get(name) ? latestUpdateFor(name, runtime, mobileDir) : undefined;
    return {
      name,
      update: update && {
        commit: update.gitCommitHash,
        at: Date.parse(update.createdAt),
        runtime: update.runtimeVersion,
      },
      build: build && { commit: build.gitCommitHash, at: Date.parse(build.completedAt ?? build.createdAt), runtime },
    };
  });
}
