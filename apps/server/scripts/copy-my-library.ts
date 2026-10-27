/**
 * Copies your library from the LIVE backend into the local library-copy account, so the dev client
 * can try the AI features on your own posts and photos. Copies the data of every collection, never
 * the files: the local server shows the copy's photos from the live storage, read-only, with the live
 * session this saves (src/storage/linkedLibrary.ts). Re-running refreshes the copy: the live records
 * win over edits made in the copy, and anything the live library doesn't have is tombstoned.
 *
 * Run: npm run copy:my-library   (from apps/server, with the local stack and `npm run dev` running;
 *                                 `npm run dev:local -- --copy-my-library` runs it for you)
 * Signs in to the live backend as LIVE_EMAIL / LIVE_PASSWORD (asked for when unset) and only reads
 * from it: the live client below allows nothing but signing in and pulling. Writes go to the local
 * backend as LIBRARY_COPY_EMAIL / LIBRARY_COPY_PASSWORD, and it refuses any non-local API URL for
 * them.
 */
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { collectionsByName, type PullResponse, type PushMutation, type PushResponse } from '@squidbox/shared';
import { LINKED_SESSION_FILE } from '../src/storage/linkedLibrary.js';

const LIVE_API_URL = process.env.LIVE_API_URL ?? 'https://squidbox-server.fly.dev/api/v1';
const LOCAL_API_URL = process.env.MOCK_API_URL ?? `http://localhost:${process.env.PORT ?? 3100}/api/v1`;
// What this script may call on the live backend: nothing that changes the library.
const LIVE_READ_ONLY_PATHS = new Set(['/auth/login', '/sync/pull']);

const copyEmail = process.env.LIBRARY_COPY_EMAIL;
const copyPassword = process.env.LIBRARY_COPY_PASSWORD;

if (!copyEmail || !copyPassword) {
  throw new Error('LIBRARY_COPY_EMAIL and LIBRARY_COPY_PASSWORD must be set (see .env.docker)');
}
if (!['localhost', '127.0.0.1'].includes(new URL(LOCAL_API_URL).hostname)) {
  throw new Error(`Refusing to copy into a non-local backend: ${LOCAL_API_URL}`);
}
if (['localhost', '127.0.0.1'].includes(new URL(LIVE_API_URL).hostname)) {
  throw new Error(`LIVE_API_URL is the local backend: ${LIVE_API_URL}`);
}

type Row = Record<string, unknown> & { id: string };
type Session = { apiUrl: string; token: string; refreshToken: string; userId: string; email: string };

const live = await signIn(LIVE_API_URL, process.env.LIVE_EMAIL ?? (await ask('Live email: ')), await livePassword());
const local = await signIn(LOCAL_API_URL, copyEmail, copyPassword);
console.log(`Copying the library of ${live.email} into ${copyEmail}`);

const now = Date.now();
// The persona, instructions and model choices are one record per user, whose id is the user's id.
const records = Object.fromEntries(
  Object.entries(await pullAll(live)).map(([collection, rows]) => [
    collection,
    rows.map((row) => ({ ...row, id: row.id === live.userId ? local.userId : row.id, updatedAt: now })),
  ]),
);
await push(local, [...toMutations(records), ...tombstonesForOtherRecords(await pullAll(local), records)]);

// The local server's way to the live files (linkedLibrary.ts): this sign-in's session, kept like a
// device's, so the live library lists it among its sessions until it expires.
await writeFile(
  LINKED_SESSION_FILE,
  JSON.stringify({ apiUrl: LIVE_API_URL, refreshToken: live.refreshToken, accessToken: live.token }),
  { mode: 0o600 },
);

console.log(
  `Copied ${Object.entries(records)
    .map(([collection, rows]) => `${rows.length} ${collection}`)
    .join(', ')}. Its photos show from your live storage, read-only.`,
);

// Every record of every collection, tombstones included, so the copy's Deleted album matches.
async function pullAll(session: Session): Promise<Record<string, Row[]>> {
  const byCollection: Record<string, Row[]> = {};
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const page = (await call(session, '/sync/pull', { cursor, limit: 1000 })) as PullResponse;
    for (const [collection, { records }] of Object.entries(page.changes)) {
      (byCollection[collection] ??= []).push(...(records as Row[]));
    }
    cursor = page.cursor;
    hasMore = page.hasMore;
  }
  return byCollection;
}

function toMutations(recordsByCollection: Record<string, Row[]>): PushMutation[] {
  return Object.entries(recordsByCollection).flatMap(([collection, rows]) => {
    const descriptor = collectionsByName[collection];
    if (!descriptor) throw new Error(`The live backend has a collection this checkout doesn't know: ${collection}`);
    return rows.map((row) => ({ collection, record: descriptor.schema.parse(row) }));
  });
}

function tombstonesForOtherRecords(localRecords: Record<string, Row[]>, keep: Record<string, Row[]>): PushMutation[] {
  const keepIds = new Set(Object.values(keep).flatMap((rows) => rows.map((row) => row.id)));
  return Object.entries(localRecords).flatMap(([collection, rows]) =>
    rows
      .filter((row) => !keepIds.has(row.id) && !row.deletedAt)
      .map((row) => ({ collection, record: { ...row, deletedAt: now, updatedAt: now } })),
  );
}

async function push(session: Session, mutations: PushMutation[]): Promise<void> {
  for (let i = 0; i < mutations.length; i += 500) {
    const { results } = (await call(session, '/sync/push', {
      mutations: mutations.slice(i, i + 500),
    })) as PushResponse;
    const rejected = results.filter((r) => r.status === 'rejected');
    if (rejected.length > 0) throw new Error(`Push rejected: ${JSON.stringify(rejected.slice(0, 3))}`);
  }
}

async function signIn(apiUrl: string, email: string, password: string): Promise<Session> {
  const { accessToken, refreshToken, user } = (await request(apiUrl, '/auth/login', { email, password })) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
  };
  return { apiUrl, token: accessToken, refreshToken, userId: user.id, email: user.email };
}

function call(session: Session, path: string, body: unknown): Promise<unknown> {
  return request(session.apiUrl, path, body, session.token);
}

async function request(apiUrl: string, path: string, body: unknown, token?: string): Promise<unknown> {
  if (apiUrl === LIVE_API_URL && !LIVE_READ_ONLY_PATHS.has(path)) {
    throw new Error(`Refusing to call ${path} on the live backend`);
  }
  const res = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function livePassword(): Promise<string> {
  return process.env.LIVE_PASSWORD ?? ask('Live password: ', { hidden: true });
}

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Set LIVE_EMAIL and LIVE_PASSWORD to copy without a terminal');
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answer = rl.question(question);
  muted = hidden;
  const value = await answer;
  rl.close();
  if (hidden) process.stdout.write('\n');
  return value.trim();
}
