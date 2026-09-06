/**
 * Multi-tenant + multi-device verification (Phase 1 checklist). Requires the local stack
 * (or real DB+S3) and both seeded users. Boots the server in-process and asserts:
 *   - two devices hold refresh tokens simultaneously; rotating one doesn't kill the other,
 *     and a rotated token can't be reused;
 *   - a second (fixture) user works end-to-end in its own namespace;
 *   - user B cannot read or delete user A's object (keys are always token-derived).
 *
 * Run: npm run verify:isolation   (after npm run local:setup)
 */
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { closeDb } from '../src/db/client.js';

loadConfig();
const A = { email: process.env.SEED_USER_EMAIL!, password: process.env.SEED_USER_PASSWORD! };
const B = { email: process.env.SEED_FIXTURE_EMAIL!, password: process.env.SEED_FIXTURE_PASSWORD! };
if (!A.email || !A.password || !B.email || !B.password) {
  throw new Error('SEED_USER_* and SEED_FIXTURE_* must be set');
}

const app = await buildApp({ logger: false });
await app.listen({ port: 0, host: '127.0.0.1' });
const { port } = app.server.address() as { port: number };
const base = `http://127.0.0.1:${port}/api/v1`;

let ok = true;
function check(label: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) ok = false;
}
const json = async (r: Response): Promise<any> => {
  try {
    return await r.clone().json();
  } catch {
    return undefined;
  }
};

async function login(cred: { email: string; password: string }) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cred),
  });
  return (await json(r)) as { accessToken: string; refreshToken: string; user: { id: string } };
}
async function refresh(token: string) {
  return fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });
}
async function upload(access: string, key: string, body: string) {
  return fetch(`${base}/assets/upload/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/octet-stream' },
    body,
  });
}
async function downloadUrl(access: string, key: string): Promise<string | undefined> {
  const r = await fetch(`${base}/assets/download-urls`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [key] }),
  });
  return (await json(r))?.urls?.[0]?.url;
}
async function del(access: string, key: string) {
  return fetch(`${base}/assets/delete`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [key] }),
  });
}

try {
  // --- Two-device refresh tokens ---
  const dev1 = await login(A);
  const dev2 = await login(A);
  check('two devices logged in (distinct refresh tokens)', dev1.refreshToken !== dev2.refreshToken);

  const r1 = await refresh(dev1.refreshToken);
  check('device 1 refresh works', r1.status === 200);
  const r1New = (await json(r1))?.refreshToken as string;

  const r2 = await refresh(dev2.refreshToken);
  check('device 2 refresh still works after device 1 rotated', r2.status === 200);

  const reuseOld = await refresh(dev1.refreshToken);
  check('device 1 old (rotated) refresh token is rejected', reuseOld.status === 401);
  const r1NewOk = await refresh(r1New);
  check('device 1 new refresh token works', r1NewOk.status === 200);

  // --- Fixture user works end-to-end in its own namespace ---
  const bTokens = await login(B);
  const bKey = `iso/b-${Date.now()}.txt`;
  check('fixture user upload', (await upload(bTokens.accessToken, bKey, 'B-data')).status === 200);
  const bUrl = await downloadUrl(bTokens.accessToken, bKey);
  check('fixture user download own file', !!bUrl && (await fetch(bUrl!)).status === 200);

  // --- Cross-tenant isolation ---
  const aTokens = await login(A);
  const aKey = `iso/a-secret-${Date.now()}.txt`;
  await upload(aTokens.accessToken, aKey, 'A-secret');

  // B asks for A's key: B's presigned URL points at B's namespace (u/<B>/aKey), which has no
  // object → not 200. B can't even express A's object.
  const bTriesAUrl = await downloadUrl(bTokens.accessToken, aKey);
  const bFetch = bTriesAUrl ? await fetch(bTriesAUrl) : undefined;
  check("user B cannot read user A's object", !bFetch || bFetch.status !== 200, `status ${bFetch?.status}`);

  // B deletes aKey: only removes B's (nonexistent) namespaced key; A's object survives.
  await del(bTokens.accessToken, aKey);
  const aUrl = await downloadUrl(aTokens.accessToken, aKey);
  const aStill = aUrl ? await fetch(aUrl) : undefined;
  const aBytes = aStill?.status === 200 ? await aStill.text() : '';
  check("user A's object survives user B's delete", aBytes === 'A-secret');

  // cleanup
  await del(aTokens.accessToken, aKey);
  await del(bTokens.accessToken, bKey);
} catch (err) {
  console.error('Isolation check threw:', err);
  ok = false;
} finally {
  await app.close();
  await closeDb();
}

console.log(ok ? '\nISOLATION: PASS' : '\nISOLATION: FAIL');
process.exit(ok ? 0 : 1);
