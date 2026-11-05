/**
 * What scripts/dev.mjs and the UI flow tests (apps/mobile/e2e) share to run the local backend's
 * scripts: their environment, and the command that resets the mock account to exactly the mock data
 * set (apps/server/scripts/seed-mock.ts).
 */
import { fileURLToPath } from 'node:url';

export const SERVER_DIR = fileURLToPath(new URL('../apps/server', import.meta.url));

export const SEED_MOCK = { command: 'npm', args: ['run', 'seed:mock', '--silent'] };

// `node --env-file` never overrides the shell, so AWS credentials exported there would win over
// MinIO's from apps/server/.env.
export function backendEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('AWS_')));
  return { ...env, ...extra };
}
