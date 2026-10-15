import { libraryPaths, type LibraryPaths } from './libraryPaths';
import type { Library } from './registry';

import { getDb, openAppDb, setOpenDb } from '@/sync/db/client';
import { getOwner, setOwner } from '@/sync/status';
import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';

export interface OpenLibrary extends LibraryPaths {
  id: string;
}

// The one open library: the only code that sets the database behind getDb().
let current: OpenLibrary | null = null;
let resolveFirstOpen: () => void;
const firstOpen = new Promise<void>((resolve) => {
  resolveFirstOpen = resolve;
});

export async function openLibrary(library: Library): Promise<void> {
  if (current) throw new Error(`Library ${current.id} is still open`);
  const paths = libraryPaths(library.id);
  const db = await openAppDb(paths.dbName);
  // A new database learns its owner here; an existing one keeps what it recorded itself.
  if (!(await getOwner(db))) await setOwner(db, library.owner);
  setOpenDb(db);
  current = { id: library.id, ...paths };
  resolveFirstOpen();
}

// Closes the open library once the statements queued before have run; everything queued after
// that rejects (driver.ts), so nothing late can write into the next library. The web thumbnail
// URLs belong to the library too.
export async function closeLibrary(): Promise<void> {
  if (!current) return;
  const db = getDb();
  setOpenDb(null);
  current = null;
  webThumbnailUrls.clear();
  await db.close();
}

export function isLibraryOpen(): boolean {
  return current !== null;
}

export function getLibrary(): OpenLibrary {
  if (!current) throw new Error('No library is open (see LibraryGate in App.js).');
  return current;
}

// Resolves once the boot has opened its library (the cloud init runs alongside that open).
export function whenLibraryOpen(): Promise<void> {
  return firstOpen;
}
