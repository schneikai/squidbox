/* eslint-env node, browser */
import { spawn } from 'node:child_process';

import { backendEnv, buildWebBundleAsync, SEED_MOCK, SERVER_DIR } from '../../../scripts/localBackend.mjs';

// Before the UI flow tests, side by side: the mock account reset to exactly the mock data set (what
// `dev:local -- --reset-data` runs), and Metro's web bundle built, so no test carries the first
// build inside its own timeout. dev.mjs builds it too once Metro answers, but Playwright starts the
// tests once the API server answers, which can be before that.
export default async function globalSetup() {
  await Promise.all([resetMockData(), buildWebBundleAsync()]);
}

function resetMockData() {
  return new Promise((resolve, reject) => {
    const seed = spawn(SEED_MOCK.command, SEED_MOCK.args, { cwd: SERVER_DIR, env: backendEnv(), stdio: 'inherit' });
    seed.once('error', reject);
    seed.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`npm run seed:mock failed (${code})`))));
  });
}
