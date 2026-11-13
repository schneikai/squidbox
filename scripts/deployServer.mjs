#!/usr/bin/env node
/**
 * Deploys the server (apps/server) to Fly.io: the one way to deploy (deploy-server skill). Before
 * `fly deploy` it checks the order of a raise of the minimum contract version (docs/sync-design.md
 * §15, Raising the minimum; scripts/deployCheck.mjs): a server that raises it deploys only once
 * every EAS channel's phones run an app with the new version. Every refusal is printed and nothing
 * is deployed.
 *
 *   npm run deploy:server                                  # builds on Fly with apps/server/Dockerfile
 *   npm run deploy:server -- --image <tag> --local-only    # a locally built image (cloud workspace)
 */
import { accessSync, constants, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contractVersion, contractVersionAt } from './contractVersion.mjs';
import { deployRefusals } from './deployCheck.mjs';
import { eas, fail, finishedBuilds, hasCommit, latestUpdate, run } from './ship.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const mobileDir = join(root, 'apps/mobile');
const FLY_CONFIG = 'apps/server/fly.toml';

const version = contractVersion();
if (version > 1) {
  const liveMinimum = await readLiveMinimum();
  const refusals = deployRefusals({
    version,
    liveMinimum,
    channels: liveMinimum !== null && liveMinimum >= version ? [] : readChannels(),
    versionAt: (commit) => (hasCommit(commit) ? contractVersionAt(commit) : 0),
  });
  if (refusals.length > 0) fail(refusals.join('\n'));
}

const extra = process.argv.slice(2);
const args = [
  'deploy',
  '.',
  '--config',
  FLY_CONFIG,
  ...(extra.length > 0 ? extra : ['--dockerfile', 'apps/server/Dockerfile']),
];
if (!run(flyCli(), args, root)) fail('fly deploy failed.');

// The deployed server's minimum contract version (`/up`; a server from before the gate has none:
// 1), or null when it can't be read: a server that is down must stay deployable, with the proof.
async function readLiveMinimum() {
  const app = /^app\s*=\s*['"]([^'"]+)['"]/m.exec(readFileSync(join(root, FLY_CONFIG), 'utf8'))?.[1];
  try {
    const response = await fetch(`https://${app}.fly.dev/up`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    return (await response.json()).minContractVersion ?? 1;
  } catch {
    return null;
  }
}

// Per channel in eas.json, its latest update and latest finished iOS build; null when EAS can't be
// read (checked once first, so an unreadable EAS refuses at once instead of after the retries).
function readChannels() {
  if (!run(eas, ['whoami'], mobileDir)) return null;
  const profiles = Object.values(JSON.parse(readFileSync(join(mobileDir, 'eas.json'), 'utf8')).build);
  const names = [...new Set(profiles.map(({ channel }) => channel).filter(Boolean))];
  return names.map((name) => {
    const update = latestUpdate(name, mobileDir);
    const [build] = finishedBuilds(['--platform', 'ios', '--channel', name, '--limit', '1'], mobileDir);
    return {
      name,
      update: update && { commit: update.gitCommitHash, at: Date.parse(update.createdAt) },
      build: build && { commit: build.gitCommitHash, at: Date.parse(build.completedAt ?? build.createdAt) },
    };
  });
}

// `fly` or `flyctl` from PATH, else the installer's ~/.fly/bin/flyctl.
function flyCli() {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  for (const name of ['fly', 'flyctl'])
    for (const dir of dirs) if (isExecutable(join(dir, name))) return join(dir, name);
  return join(homedir(), '.fly/bin/flyctl');
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
