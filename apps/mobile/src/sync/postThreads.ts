import type { PostAssetRecord, PostRecord } from '@squidbox/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import * as posts from './postsRepository';

// A post's thread (sync-design §10): its following posts are posts of their own, linked to the first
// post by `threadRootId` and ordered by `(threadIndex, id)`. Every function writes inside the caller's
// transaction, so a user action commits the first post and its following posts at once.

// A post's photo as the editor holds it: the post-asset edge's id and its asset.
export type AssetRef = Pick<PostAssetRecord, 'id' | 'assetId'>;
/** One following post as the editor emits it: `id` null for a new one. */
export type ThreadPart = { id: string | null; text: string; assetRefs: AssetRef[] };
type NewPart = Pick<PostRecord, 'text' | 'postedAt'> & { threadRootId: string; threadIndex: number };

/**
 * The live posts linked to `rootIds` by `root`: a thread's following posts (`threadRootId`), each
 * thread's in `(threadIndex, id)` order, or a post's other channels (`channelRootId`), in id order.
 */
export function readChildPosts(tx: SyncDb, root: 'threadRootId' | 'channelRootId', rootIds: string[]) {
  const p = schema.posts;
  const order =
    root === 'threadRootId' ? [asc(p.threadRootId), asc(p.threadIndex), asc(p.id)] : [asc(p.channelRootId), asc(p.id)];
  return tx
    .select()
    .from(p)
    .where(and(inJson(p[root], rootIds), isNull(p.deletedAt)))
    .orderBy(...order);
}

/** The live following posts of `rootIds`, each thread's in `(threadIndex, id)` order. */
export function readThreadPosts(tx: SyncDb, rootIds: string[]) {
  return readChildPosts(tx, 'threadRootId', rootIds);
}

/**
 * Save an editor's following posts (`parts`) over the ones it was seeded with (`seedParts`; `[]` for
 * a new thread): a seed part the list no longer has is removed with its edges, a listed one gets its
 * changed text and photos, a new one (no id) is created by `newPart` after the thread's last, with
 * the first post's `postedAt` as it stands in `tx` (it may have changed since the editor opened). A
 * seed part deleted meanwhile (another device) is left as it is.
 */
export async function saveThreadPosts(
  tx: SyncDb,
  rootId: string,
  parts: ThreadPart[],
  seedParts: ThreadPart[],
  newPart: (fields: NewPart) => PostRecord,
): Promise<void> {
  if (parts.length === 0 && seedParts.length === 0) return;
  const postedAt = await readPostedAt(tx, rootId);
  const live = await readThreadPosts(tx, [rootId]);
  const { removed, kept, added } = splitParts(parts, seedParts, new Set(live.map((post) => post.id)));
  await removePosts(tx, removed);

  let threadIndex = Math.max(0, ...live.map((post) => post.threadIndex ?? 0));
  for (const part of added) {
    threadIndex += 1;
    const created = await posts.create(tx, newPart({ text: part.text, postedAt, threadRootId: rootId, threadIndex }));
    await posts.postEdges.createFromRefs(tx, created.id, part.assetRefs);
  }
  for (const { id, part, seed } of kept) {
    if (part.text !== seed.text) await posts.update(tx, id, { text: part.text });
    await posts.postEdges.setRefs(tx, id, part.assetRefs, seed.assetRefs); // writes only what changed
  }
}

/**
 * How an editor's parts (`parts`, `id` null for a new one) split over the ones it was seeded with
 * (`seedParts`), against the ids still live in the database: the ids of the seed parts no longer
 * listed (`removed`), the new parts in order (`added`), and the listed ones with their seed
 * (`kept`). A seed part deleted meanwhile (another device) is in neither.
 */
export function splitParts<P extends { id: string | null }>(parts: P[], seedParts: P[], liveIds: Set<string>) {
  const listed = new Set(parts.map((part) => part.id));
  const seedById = new Map(seedParts.map((part) => [part.id, part]));
  return {
    removed: seedParts.flatMap((part) => (part.id && liveIds.has(part.id) && !listed.has(part.id) ? [part.id] : [])),
    added: parts.filter((part) => part.id === null),
    kept: parts.flatMap((part) => {
      const seed = part.id === null ? undefined : seedById.get(part.id);
      return part.id !== null && seed && liveIds.has(part.id) ? [{ id: part.id, part, seed }] : [];
    }),
  };
}

/** A post's Posted time as it stands in `tx` (null for none, or no such post). */
export async function readPostedAt(tx: SyncDb, postId: string): Promise<number | null> {
  const [post] = await tx
    .select({ postedAt: schema.posts.postedAt })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId));
  return post?.postedAt ?? null;
}

/** Give the live following posts of the threads of `rootIds` their first post's Posted time (null included). */
export async function setThreadsPostedAt(tx: SyncDb, rootIds: string[], postedAt: number | null): Promise<void> {
  const ids = (await readThreadPosts(tx, rootIds)).map((post) => post.id);
  if (ids.length > 0) await posts.updateAll(tx, ids, { postedAt });
}

/** Delete posts with their threads: tombstones the posts, their live following posts and all their edges. */
export async function removeThreads(tx: SyncDb, rootIds: string[]): Promise<void> {
  if (rootIds.length === 0) return;
  const following = (await readThreadPosts(tx, rootIds)).map((post) => post.id);
  await removePosts(tx, [...rootIds, ...following]);
}

async function removePosts(tx: SyncDb, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await posts.remove(tx, ids);
  await posts.postEdges.tombstoneParents(tx, ids);
}
