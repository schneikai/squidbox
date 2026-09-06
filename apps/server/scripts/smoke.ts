/**
 * End-to-end smoke test — the Phase 1 manual gate. Requires a real Postgres (migrated +
 * seeded) and real AWS/S3 credentials in the environment (.env). Boots the server in-process
 * on an ephemeral port and drives the full flow with fetch:
 *   login → /me → small upload → download+verify → >210 MB streaming upload → verify → delete.
 *
 * Run: npm run smoke   (from apps/server, with .env populated and `db:migrate`+`db:seed` done)
 */
import { Readable } from 'node:stream';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { closeDb } from '../src/db/client.js';

loadConfig();
const email = process.env.SEED_USER_EMAIL;
const password = process.env.SEED_USER_PASSWORD;
if (!email || !password) throw new Error('SEED_USER_EMAIL and SEED_USER_PASSWORD must be set for the smoke test');

const app = await buildApp({ logger: false });
await app.listen({ port: 0, host: '127.0.0.1' });
const { port } = app.server.address() as { port: number };
const base = `http://127.0.0.1:${port}/api/v1`;

let ok = true;
function check(label: string, cond: boolean, detail = ''): void {
  console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) ok = false;
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

try {
  // 1. login
  const loginRes = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const login = await json(loginRes);
  check('login', loginRes.status === 200 && !!login.accessToken, `status ${loginRes.status}`);
  const accessToken = login.accessToken;
  const authHeader = { authorization: `Bearer ${accessToken}` };

  // 2. /me
  const meRes = await fetch(`${base}/me`, { headers: authHeader });
  const me = await json(meRes);
  check('GET /me', meRes.status === 200 && me.user?.email === email);

  // 3. small upload
  const smallKey = `smoke/small-${Date.now()}.bin`;
  const smallBody = Buffer.from('squidbox smoke test payload');
  const upSmall = await fetch(`${base}/assets/upload/${encodeURIComponent(smallKey)}`, {
    method: 'PUT',
    headers: { ...authHeader, 'content-type': 'application/octet-stream' },
    body: smallBody,
  });
  check('upload small', upSmall.status === 200, `status ${upSmall.status}`);

  // 4. download small + verify bytes
  const dl = await fetch(`${base}/assets/download-urls`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [smallKey] }),
  });
  const dlBody = await json(dl);
  const smallUrl = dlBody.urls?.[0]?.url;
  check('download-urls (small)', dl.status === 200 && !!smallUrl);
  if (smallUrl) {
    const fetched = Buffer.from(await (await fetch(smallUrl)).arrayBuffer());
    check('small bytes match', fetched.equals(smallBody));
  }

  // 5. large streaming upload (>210 MB) — forces server-side S3 multipart
  const largeKey = `smoke/large-${Date.now()}.bin`;
  const LARGE_SIZE = 210 * 1024 * 1024; // 220,200,960 bytes
  const CHUNK = 8 * 1024 * 1024;
  let remaining = LARGE_SIZE;
  const largeStream = new Readable({
    read() {
      if (remaining <= 0) return this.push(null);
      const n = Math.min(CHUNK, remaining);
      remaining -= n;
      this.push(Buffer.alloc(n));
    },
  });
  // Node fetch needs `duplex: 'half'` to stream a request body; not in the DOM RequestInit type.
  const largeInit: any = {
    method: 'PUT',
    headers: { ...authHeader, 'content-type': 'application/octet-stream' },
    body: largeStream,
    duplex: 'half',
  };
  const upLarge = await fetch(`${base}/assets/upload/${encodeURIComponent(largeKey)}`, largeInit);
  check('upload large (>210MB, multipart)', upLarge.status === 200, `status ${upLarge.status}`);

  // 6. verify large size via a presigned HEAD
  const dlLarge = await fetch(`${base}/assets/download-urls`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [largeKey] }),
  });
  const largeUrl = (await json(dlLarge)).urls?.[0]?.url;
  if (largeUrl) {
    // Ranged GET: the presigned URL is signed for GET (HEAD would 403). Range isn't signed, so
    // we can ask for 1 byte and read the total object size from the Content-Range header.
    const ranged = await fetch(largeUrl, { headers: { Range: 'bytes=0-0' } });
    const total = Number(ranged.headers.get('content-range')?.split('/')[1]);
    check('large size matches', total === LARGE_SIZE, `got ${total}`);
  }

  // 7. delete both
  const del = await fetch(`${base}/assets/delete`, {
    method: 'POST',
    headers: { ...authHeader, 'content-type': 'application/json' },
    body: JSON.stringify({ keys: [smallKey, largeKey] }),
  });
  check('delete', del.status === 200);
} catch (err) {
  console.error('Smoke test threw:', err);
  ok = false;
} finally {
  await app.close();
  await closeDb();
}

console.log(ok ? '\nSMOKE: PASS' : '\nSMOKE: FAIL');
process.exit(ok ? 0 : 1);
