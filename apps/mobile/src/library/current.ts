import { libraryPaths, type LibraryPaths } from './libraryPaths';
import { getRegistry, type Library } from './registry';

import { getDb, openAppDb, setOpenDb } from '@/sync/db/client';
import { retryFailures } from '@/sync/outbox';
import { getOwner, setOwner } from '@/sync/status';
import { sweepPurgedFiles } from '@/sync/sweepPurgedFiles';
import webThumbnailUrls from '@/utils/assets/thumbnails/webThumbnailUrls';

export interface OpenLibrary extends LibraryPaths {
  id: string;
}

// The one open library: the only code that sets the database behind getDb().
let current: OpenLibrary | null = null;
// The sweep an open starts, stopped when the library closes.
let openSweep: AbortController | null = null;

export async function openLibrary(library: Library): Promise<void> {
  if (current) throw new Error(`Library ${current.id} is still open`);
  const paths = libraryPaths(library.id);
  const db = await openAppDb(paths.dbName);
  try {
    // A new database learns its owner here; an existing one keeps what it recorded itself.
    if (!(await getOwner(db))) await setOwner(db, library.owner);
    // Each open (a launch, a switch) gives the failed pushes another try (sync-design §6).
    await retryFailures(db);
  } catch (error) {
    await db.close().catch(() => {}); // not published yet: closeLibrary wouldn't see it
    throw error;
  }
  setOpenDb(db);
  current = { id: library.id, ...paths };
  // Then, without holding up the open, it removes the files of the purged assets whose purge is
  // confirmed (§7a); the file system needs the native modules the tests lack.
  const sweep = new AbortController();
  openSweep = sweep;
  import('./fs')
    .then(({ removeAssetFiles }) =>
      sweepPurgedFiles(db, (files) => removeAssetFiles(files, paths), { signal: sweep.signal }),
    )
    .catch((error) => console.warn('Could not remove the files of the purged assets', error));
}

// Closes the open library once the statements queued before have run; everything queued after
// that rejects (driver.ts), so nothing late can write into the next library. The web thumbnail
// URLs belong to the library too.
export async function closeLibrary(): Promise<void> {
  if (!current) return;
  const db = getDb();
  openSweep?.abort();
  openSweep = null;
  setOpenDb(null);
  current = null;
  webThumbnailUrls.clear();
  await db.close();
}

export function openLibraryId(): string | null {
  return current?.id ?? null;
}

// The open library's entry in the list, or null while none is open.
export function openLibraryEntry(): Library | null {
  if (!current) return null;
  const id = current.id;
  return getRegistry().libraries.find((library) => library.id === id) ?? null;
}

export function getLibrary(): OpenLibrary {
  if (!current) throw new Error('No library is open (see LibraryGate in App.js).');
  return current;
}
