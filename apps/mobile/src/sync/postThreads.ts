import type { PostRecord } from '@squidbox/shared';
import { and, asc, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import * as posts from './postsRepository';
import { postEdges } from './postsRepository';

// A post's thread (sync-design §10): its following posts are posts of their own, linked to the first
// post by `threadRootId` and ordered by `(threadIndex, id)`. Every function writes inside the caller's
// transaction, so a user action commits the first post and its following posts at once.

type AssetRef = { id: string; assetId: string };
/** One following post as the editor emits it: `id` null for a new one. */
export type ThreadPart = { id: string | null; text: string; assetRefs: AssetRef[] };
type NewPart = Pick<PostRecord, 'text' | 'postedAt'> & { threadRootId: string; threadIndex: number };

/** The live following posts of `rootIds`, each thread's in `(threadIndex, id)` order. */
export function readThreadPosts(tx: SyncDb, rootIds: string[]) {
  const p = schema.posts;
  return tx
    .select()
    .from(p)
    .where(and(inJson(p.threadRootId, rootIds), isNull(p.deletedAt)))
    .orderBy(asc(p.threadRootId), asc(p.threadIndex), asc(p.id));
}

/**
 * Save an editor's following posts (`parts`) over the ones it was seeded with (`seedParts`; `[]` for
 * a new thread): a seed part the list no longer has is removed with its edges, a listed one gets its
 * changed text and photos, a new one (no id) is created by `newPart` after the thread's last, with
 * the thread's `postedAt`. A seed part deleted meanwhile (another device) is left as it is.
 */
export async function saveThreadPosts(
  tx: SyncDb,
  rootId: string,
  parts: ThreadPart[],
  seedParts: ThreadPart[],
  { postedAt, newPart }: { postedAt: number | null; newPart: (fields: NewPart) => PostRecord },
): Promise<void> {
  if (parts.length === 0 && seedParts.length === 0) return;
  const live = await readThreadPosts(tx, [rootId]);
  const liveById = new Map(live.map((post) => [post.id, post]));
  const listed = new Set(parts.map((part) => part.id));
  const seedById = new Map(seedParts.map((part) => [part.id, part]));

  const removed = seedParts.filter((part) => part.id && liveById.has(part.id) && !listed.has(part.id));
  await removePosts(
    tx,
    removed.map((part) => part.id!),
  );

  let threadIndex = Math.max(0, ...live.map((post) => post.threadIndex ?? 0));
  for (const part of parts) {
    if (part.id === null) {
      threadIndex += 1;
      const created = await posts.create(tx, newPart({ text: part.text, postedAt, threadRootId: rootId, threadIndex }));
      await postEdges.createFromRefs(tx, created.id, part.assetRefs);
      continue;
    }
    const seed = seedById.get(part.id);
    if (!liveById.has(part.id) || !seed) continue;
    if (part.text !== seed.text) await posts.update(tx, part.id, { text: part.text });
    await postEdges.setRefs(tx, part.id, part.assetRefs, seed.assetRefs); // writes only what changed
  }
}

/** Give the thread's live following posts the first post's Posted time (null included). */
export async function setThreadPostedAt(tx: SyncDb, rootId: string, postedAt: number | null): Promise<void> {
  const ids = (await readThreadPosts(tx, [rootId])).map((post) => post.id);
  if (ids.length > 0) await posts.updateAll(tx, ids, { postedAt });
}

/** Delete a post with its thread: tombstones the post, its live following posts and all their edges. */
export async function removeThread(tx: SyncDb, rootId: string): Promise<void> {
  const following = (await readThreadPosts(tx, [rootId])).map((post) => post.id);
  await removePosts(tx, [rootId, ...following]);
}

async function removePosts(tx: SyncDb, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await posts.remove(tx, ids);
  for (const id of ids) await postEdges.tombstoneParent(tx, id);
}
