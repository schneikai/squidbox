/**
 * The local backend as scripts/dev.mjs runs it, for dev.mjs itself and the scripts that drive the
 * app against it (apps/mobile/scripts/webPreview.mjs, the UI flow tests in apps/mobile/e2e): where
 * Metro and the API server answer, the server's folder and environment, the command that resets the
 * mock account to exactly the mock data set, and the web bundle the preview loads.
 */
import { fileURLToPath } from 'node:url';

export const METRO_URL = 'http://localhost:8081';
export const SERVER_URL = 'http://localhost:3100';
export const SERVER_DIR = fileURLToPath(new URL('../apps/server', import.meta.url));

export const SEED_MOCK = { command: 'npm', args: ['run', 'seed:mock', '--silent'] };

// `node --env-file` never overrides the shell, so AWS credentials exported there would win over
// MinIO's from apps/server/.env.
export function backendEnv(extra = {}) {
  return { ...withoutKeys(process.env, (key) => key.startsWith('AWS_')), ...extra };
}

export function withoutKeys(env, isExcluded) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !isExcluded(key)));
}

// Metro builds a bundle on its first request (minutes on a cold cache): asks for the ones the web
// page loads, as the browser would, so they are ready (and later requests cache hits). Throws when
// Metro can't build one.
export async function buildWebBundleAsync() {
  const html = await (await fetch(`${METRO_URL}/`)).text();
  const bundles = [...html.matchAll(/<script[^>]* src="([^"]+\.bundle[^"]*)"/g)].map(
    ([, src]) => new URL(src.replaceAll('&amp;', '&'), METRO_URL),
  );
  if (bundles.length === 0) throw new Error(`No bundle in the page at ${METRO_URL}`);
  for (const url of bundles) {
    const res = await fetch(url);
    const body = await res.text();
    if (!res.ok) throw new Error(`Metro couldn't build the web bundle:\n${body.slice(0, 2000)}`);
  }
}
