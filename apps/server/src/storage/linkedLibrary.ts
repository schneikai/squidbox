import { readFile, writeFile } from 'node:fs/promises';
import type { DownloadUrlsResponse } from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';
import type { User } from '../db/schema.js';

// Local dev only. The library-copy account (LIBRARY_COPY_EMAIL) is a copy of the owner's live
// library whose files were never copied: they stay in the live storage, and this server asks the live
// backend for their download URLs with the session `npm run copy:my-library` saved. It only ever
// calls the live download-urls and refresh routes, so nothing here can change the live library.
// Uploads are refused (readOnlyLibraryError), and deletes reach only this server's own storage, where
// the copy has no files.
export const LINKED_SESSION_FILE = new URL('../../.library-copy-session.json', import.meta.url);

interface LinkedSession {
  apiUrl: string;
  refreshToken: string;
  accessToken?: string;
}

let refreshing: Promise<LinkedSession> | null = null;

export function isLinkedLibrary(user: User): boolean {
  const email = loadConfig().LIBRARY_COPY_EMAIL;
  return Boolean(email) && user.email === email;
}

export function readOnlyLibraryError(): AppError {
  return new AppError(403, 'read_only_library', 'This copy of your library shows your live files and takes no uploads');
}

export async function linkedDownloadUrls(keys: string[], expiresIn: number): Promise<DownloadUrlsResponse> {
  let session = await readSession();
  if (!session.accessToken) session = await refreshSession(session);
  let res = await requestUrls(session, keys, expiresIn);
  if (res.status === 401) res = await requestUrls(await refreshSession(session), keys, expiresIn);
  if (!res.ok) throw AppError.s3(`The live backend answered ${res.status} for download URLs`);
  return (await res.json()) as DownloadUrlsResponse;
}

function requestUrls(session: LinkedSession, keys: string[], expiresIn: number): Promise<Response> {
  return fetch(`${session.apiUrl}/assets/download-urls`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ keys, expiresIn }),
  });
}

// One refresh at a time: the live backend rotates the refresh token, and the new one is saved for the
// next start.
function refreshSession(session: LinkedSession): Promise<LinkedSession> {
  refreshing ??= (async () => {
    const res = await fetch(`${session.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) {
      throw AppError.s3(`The live session ended (${res.status}): run npm run copy:my-library again`);
    }
    const { accessToken, refreshToken } = (await res.json()) as { accessToken: string; refreshToken: string };
    const next = { apiUrl: session.apiUrl, refreshToken, accessToken };
    await writeFile(LINKED_SESSION_FILE, JSON.stringify(next), { mode: 0o600 });
    return next;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function readSession(): Promise<LinkedSession> {
  if (refreshing) return refreshing;
  try {
    return JSON.parse(await readFile(LINKED_SESSION_FILE, 'utf8')) as LinkedSession;
  } catch {
    throw AppError.s3('No live session for the library copy: run npm run copy:my-library');
  }
}
