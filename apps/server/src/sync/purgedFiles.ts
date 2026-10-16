import { and, asc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DELETE_KEYS_MAX } from '@squidbox/shared';
import type { Db } from '../db/client.js';
import { assets } from '../db/schema.js';
import { isValidFileKey } from '../storage/resolver.js';
import { withUserLock, type Tx } from './push.js';

const BATCH = DELETE_KEYS_MAX / 2; // assets per S3 request: a file and a thumbnail each

/** Deletes these keys from the user's storage in one request; resolves to the keys that failed. */
export type DeleteKeys = (keys: string[]) => Promise<string[]>;

type PurgedAsset = { id: string; filename: string; thumbnailFilename: string };

/**
 * Deletes the S3 files of this user's purged assets that the cleanup hasn't deleted yet, whatever
 * their file flags say (a device's upload can finish before it pushes them; a missing key counts as
 * deleted), and marks each asset whose keys are gone with the server-only `files_deleted_at`
 * (sync-design §7a). One pass in id order, so an asset whose key keeps failing stays for the next
 * cleanup without holding up the others. An invalid key can't name a stored file and is skipped. A
 * failed request throws and leaves its batch for the next cleanup.
 */
export async function deletePurgedFiles(db: Db, userId: string, deleteKeys: DeleteKeys): Promise<void> {
  let after: string | undefined;
  for (;;) {
    const purged = await db
      .select({ id: assets.id, filename: assets.filename, thumbnailFilename: assets.thumbnailFilename })
      .from(assets)
      .where(
        and(
          eq(assets.userId, userId),
          isNotNull(assets.purgedAt),
          isNull(assets.filesDeletedAt),
          after === undefined ? undefined : gt(assets.id, after),
        ),
      )
      .orderBy(asc(assets.id))
      .limit(BATCH);
    if (purged.length === 0) return;
    await withUserLock(db, userId, (tx) => deleteBatch(tx, userId, purged, deleteKeys));
    if (purged.length < BATCH) return;
    after = purged[purged.length - 1]!.id;
  }
}

// Under the user's lock, held through the S3 request: no push can add an asset naming one of these
// keys between the check and the delete. The marker write gets a new server_seq like any update, so
// the devices pull the unchanged record once more, which costs them nothing (§7a).
async function deleteBatch(tx: Tx, userId: string, purged: PurgedAsset[], deleteKeys: DeleteKeys): Promise<void> {
  const keys = [...new Set(purged.flatMap(fileKeys))];
  const inUse = await keysInUse(tx, userId, keys);
  const unused = keys.filter((key) => !inUse.has(key));
  const failed = new Set(unused.length > 0 ? await deleteKeys(unused) : []);
  const done = purged.filter((asset) => !fileKeys(asset).some((key) => failed.has(key))).map((asset) => asset.id);
  if (done.length === 0) return;
  await tx
    .update(assets)
    .set({ filesDeletedAt: Date.now() })
    .where(and(eq(assets.userId, userId), inArray(assets.id, done)));
}

function fileKeys(asset: PurgedAsset): string[] {
  return [asset.filename, asset.thumbnailFilename].filter(isValidFileKey);
}

/** Whether every asset of this user naming the key, at least one, is purged: its file must not be stored. */
export async function isPurgedFileKey(db: Db, userId: string, key: string): Promise<boolean> {
  const [row] = await db
    .select({ purged: sql<boolean | null>`bool_and(${assets.purgedAt} is not null)` })
    .from(assets)
    .where(and(eq(assets.userId, userId), or(eq(assets.filename, key), eq(assets.thumbnailFilename, key))));
  return row?.purged === true;
}

// The keys among these that an asset of this user that isn't purged names.
async function keysInUse(tx: Tx, userId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await tx
    .select({ filename: assets.filename, thumbnailFilename: assets.thumbnailFilename })
    .from(assets)
    .where(
      and(
        eq(assets.userId, userId),
        isNull(assets.purgedAt),
        or(inArray(assets.filename, keys), inArray(assets.thumbnailFilename, keys)),
      ),
    );
  return new Set(rows.flatMap((row) => [row.filename, row.thumbnailFilename]));
}

// Per user, the cleanup running and whether another push asked for one since it started.
const cleanups = new Map<string, { again: boolean; done: Promise<void> }>();

/**
 * Starts this user's cleanup after the current request's reply, not awaited by it. At most one runs
 * per user: a push during a run asks for one more pass after it. A failure goes to `onError`; the
 * next push retries.
 */
export function cleanUpPurgedFiles(
  db: Db,
  userId: string,
  deleteKeys: DeleteKeys,
  onError: (error: unknown) => void,
): void {
  const running = cleanups.get(userId);
  if (running) {
    running.again = true;
    return;
  }
  const cleanup = { again: true, done: Promise.resolve() };
  cleanups.set(userId, cleanup);
  cleanup.done = (async () => {
    await new Promise((resolve) => setImmediate(resolve)); // once the reply is written
    while (cleanup.again) {
      cleanup.again = false;
      await deletePurgedFiles(db, userId, deleteKeys).catch(onError);
    }
    cleanups.delete(userId);
  })();
}

/** Resolves once no cleanup is running (for tests). */
export async function purgedFileCleanupsSettled(): Promise<void> {
  while (cleanups.size > 0) await Promise.all([...cleanups.values()].map((cleanup) => cleanup.done));
}
