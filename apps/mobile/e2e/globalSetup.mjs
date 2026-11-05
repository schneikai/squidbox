/* eslint-env node, browser */
import { spawnSync } from 'node:child_process';

import { openWebPreview } from '../scripts/webPreview.mjs';

const SERVER_DIR = new URL('../../server/', import.meta.url).pathname;

// Before the UI flow tests: the mock account reset to exactly the mock data set (what
// `dev:local -- --reset-data` runs), then Metro's web bundle built once, so no test carries the
// first build (minutes on a cold cache) inside its own timeout.
export default async function globalSetup() {
  // AWS credentials exported in the shell would win over MinIO's from apps/server/.env (as in dev.mjs).
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('AWS_')));
  const seed = spawnSync('npm', ['run', 'seed:mock', '--silent'], { cwd: SERVER_DIR, env, stdio: 'inherit' });
  if (seed.status !== 0) throw new Error(`npm run seed:mock failed (${seed.status ?? seed.signal})`);

  const { close } = await openWebPreview();
  await close();
}
