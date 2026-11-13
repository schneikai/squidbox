import type { PostRecord } from '@squidbox/shared';
import { and, asc, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import {
  readPostedAt,
  removeThreads,
  saveThreadPosts,
  setThreadsPostedAt,
  splitParts,
  type AssetRef,
  type ThreadPart,
} from './postThreads';
import * as posts from './postsRepository';

// A post's other channels (sync-design §10): each is a post of its own, linked to the post by
// `channelRootId`, with its own `channelId`, edges and thread. Every function writes inside the
// caller's transaction, so a user action commits the post and all its channels at once.

/** One other channel of a post as the editor emits it: `id` null for a new one. */
export type ChannelPart = {
  id: string | null;
  channelId: string;
  text: string;
  assetRefs: AssetRef[];
  threadPosts: ThreadPart[];
};

/** Builds a new post (another channel, or a following post) from its fields over a new post's defaults. */
type NewPost = (fields: Partial<PostRecord>) => PostRecord;

/** The live other channels of `rootIds`, each post's in id order. */
export function readChannelPosts(tx: SyncDb, rootIds: string[]) {
  const p = schema.posts;
  return tx
    .select()
    .from(p)
    .where(and(inJson(p.channelRootId, rootIds), isNull(p.deletedAt)))
    .orderBy(asc(p.channelRootId), asc(p.id));
}

/**
 * Save an editor's other channels (`parts`) over the ones it was seeded with (`seedParts`; `[]` for
 * a new post): a seed part no longer listed is removed with its thread, a new one (no id) is created
 * by `newPost` with the post's `postedAt` as it stands in `tx`, its edges and its thread, and a listed
 * one gets its changed text, channel, photos and thread. A seed part deleted meanwhile is left alone.
 */
export async function saveChannelPosts(
  tx: SyncDb,
  rootId: string,
  parts: ChannelPart[],
  seedParts: ChannelPart[],
  newPost: NewPost,
): Promise<void> {
  if (parts.length === 0 && seedParts.length === 0) return;
  const live = await readChannelPosts(tx, [rootId]);
  const { removed, kept, added } = splitParts(parts, seedParts, new Set(live.map((post) => post.id)));
  await removeThreads(tx, removed);

  const postedAt = await readPostedAt(tx, rootId);
  for (const part of added) {
    const fields = { text: part.text, channelId: part.channelId, channelRootId: rootId, postedAt };
    const created = await posts.create(tx, newPost(fields));
    await posts.postEdges.createFromRefs(tx, created.id, part.assetRefs);
    await saveThreadPosts(tx, created.id, part.threadPosts, [], newPost);
  }
  for (const { id, part, seed } of kept) {
    const changes: Partial<PostRecord> = {};
    if (part.text !== seed.text) changes.text = part.text;
    if (part.channelId !== seed.channelId) changes.channelId = part.channelId;
    if (Object.keys(changes).length > 0) await posts.update(tx, id, changes);
    await posts.postEdges.setRefs(tx, id, part.assetRefs, seed.assetRefs); // writes only what changed
    await saveThreadPosts(tx, id, part.threadPosts, seed.threadPosts, newPost);
  }
}

/** Give the post's thread, its live other channels and their threads the post's Posted time. */
export async function setPostPostedAt(tx: SyncDb, rootId: string, postedAt: number | null): Promise<void> {
  const copies = (await readChannelPosts(tx, [rootId])).map((post) => post.id);
  if (copies.length > 0) await posts.updateAll(tx, copies, { postedAt });
  await setThreadsPostedAt(tx, [rootId, ...copies], postedAt);
}

/** Delete a post on all its channels: its thread, its live other channels and their threads, with their edges. */
export async function removePost(tx: SyncDb, rootId: string): Promise<void> {
  const copies = (await readChannelPosts(tx, [rootId])).map((post) => post.id);
  await removeThreads(tx, [rootId, ...copies]);
}
