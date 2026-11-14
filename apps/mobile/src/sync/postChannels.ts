import type { PostRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import {
  readChildPosts,
  readPostedAt,
  removeThreads,
  saveThreadPosts,
  setThreadsPostedAt,
  splitParts,
  type AssetRef,
  type ThreadPart,
} from './postThreads';
import * as posts from './postsRepository';
import versionChannelFields from './versionChannelFields';
import versionChannelIds from './versionChannelIds';

import sameOrder from '@/lib/sameOrder';

// A post's other versions (sync-design §10): each is a post of its own, linked to the post by
// `channelRootId`, with its own channels (`channelId` and `extraChannelIds`, versionChannelFields),
// edges and thread. Every function writes inside the caller's transaction, so a user action commits
// the post and all its versions at once.

/** One other version of a post as the editor emits it: `id` null for a new one; `channelIds` never empty. */
export type ChannelPart = {
  id: string | null;
  channelIds: string[];
  text: string;
  assetRefs: AssetRef[];
  threadPosts: ThreadPart[];
};

/** Builds a new post (another channel, or a following post) from its fields over a new post's defaults. */
type NewPost = (fields: Partial<PostRecord>) => PostRecord;

/** The live other channels of `rootIds`, each post's in id order. */
export function readChannelPosts(tx: SyncDb, rootIds: string[]) {
  return readChildPosts(tx, 'channelRootId', rootIds);
}

/**
 * Save an editor's other versions (`parts`) over the ones it was seeded with (`seedParts`; `[]` for
 * a new post): a seed part no longer listed is removed with its thread, a new one (no id) is created
 * by `newPost` with the post's `postedAt` as it stands in `tx`, its edges and its thread, and a listed
 * one gets its changed text, channels, photos and thread. A seed part deleted meanwhile is left alone.
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
    const fields = { text: part.text, ...versionChannelFields(part.channelIds), channelRootId: rootId, postedAt };
    const created = await posts.create(tx, newPost(fields));
    await posts.postEdges.createFromRefs(tx, created.id, part.assetRefs);
    await saveThreadPosts(tx, created.id, part.threadPosts, [], newPost);
  }
  for (const { id, part, seed } of kept) {
    const changes: Partial<PostRecord> = {};
    if (part.text !== seed.text) changes.text = part.text;
    if (!sameOrder(part.channelIds, seed.channelIds)) Object.assign(changes, versionChannelFields(part.channelIds));
    if (Object.keys(changes).length > 0) await posts.update(tx, id, changes);
    await posts.postEdges.setRefs(tx, id, part.assetRefs, seed.assetRefs); // writes only what changed
    await saveThreadPosts(tx, id, part.threadPosts, seed.threadPosts, newPost);
  }
}

/**
 * Write every live version's channels of the post `rootId` as the read rule gives them
 * (versionChannelIds), where its stored fields differ: an extra the read hides (another version holds
 * it, after an installed build's edit) is written away, so it can't come back once that version goes.
 */
export async function repairVersionChannels(tx: SyncDb, rootId: string): Promise<void> {
  const [root] = await tx
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, rootId), isNull(schema.posts.deletedAt)));
  if (!root) return;
  const versions = [root, ...(await readChannelPosts(tx, [rootId]))];
  const channelIds = versionChannelIds(versions);
  for (const [i, version] of versions.entries()) {
    const stored = [version.channelId ?? [], version.extraChannelIds ?? []].flat();
    if (!sameOrder(channelIds[i]!, stored)) await posts.update(tx, version.id, versionChannelFields(channelIds[i]!));
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
