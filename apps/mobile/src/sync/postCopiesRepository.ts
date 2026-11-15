import { postCopyCollection, type PostCopyPost, type PostCopyRecord } from '@squidbox/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import readPost from './queries/readPost';
import { readByIdMap, readByIds } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

import uuidV5 from '@/lib/uuidV5';
import newRecord from '@/utils/newRecord';
import postAsCopyPosts from '@/utils/posts/postAsCopyPosts';

// A post's channel copies (Send to channels, sync-design §10): the only writer of the post_copies
// table. Every function writes inside the caller's transaction, so a user action commits at once.
// A card the user hasn't touched is not stored (readChannelCopies builds it from the post): a write on
// it stores it first, as it shows, under its fixed id (`copyIdOf`). A removed copy is a tombstone,
// and a tombstone means the post doesn't go to that channel: only + (`addCopyFromPost`) revives it.

const t = schema.postCopies;
const repository = makeRepository('post_copies', t);

// The namespace of the copies' fixed ids. Stored data: never change it.
const COPY_ID_NAMESPACE = '08224fd5-0fed-416b-b0a5-0aeec90d275c';

/**
 * A card of Send to channels as a write takes it (a ChannelCopy, or a stored record): its stored or
 * fixed id, and what it shows.
 */
export type CopyRef = Pick<PostCopyRecord, 'id' | 'postId' | 'channelId' | 'posts'>;

/**
 * The fixed id of the post's copy for a channel (a uuid v5 of both), the same on every device: two
 * devices storing the same card offline write one record. Copies made before it keep their random ids.
 */
export function copyIdOf(postId: string, channelId: string): string {
  return uuidV5(`${postId}:${channelId}`, COPY_ID_NAMESPACE);
}

/**
 * A copy of `postId` for `channelId`, unsent, under `copyIdOf`. A live copy there is returned as it
 * is (a second tap); a removed one throws. A record there that is no longer the post's (the mock
 * data's reset moves one off its post, seed-mock) is taken over. Its posts over a limit throw the
 * schema's message.
 * `createdAt` (now without it) orders the copies of channels no longer in the user's channels:
 * copies made together pass one each, in order, so they list in that order.
 */
export async function createCopy(
  tx: SyncDb,
  {
    postId,
    channelId,
    posts,
    createdAt,
  }: Pick<PostCopyRecord, 'postId' | 'channelId' | 'posts'> & { createdAt?: number },
): Promise<PostCopyRecord> {
  const id = copyIdOf(postId, channelId);
  const [stored] = await readByIds(tx, t, [id]);
  if (stored?.postId === postId) {
    if (stored.deletedAt !== null) throw new Error('This copy was deleted');
    return stored;
  }
  if (stored) return revive(tx, stored, { postId, posts });
  return repository.create(
    tx,
    newRecord(postCopyCollection, {}, { id, postId, channelId, posts, sentAt: null, createdAt, updatedAt: createdAt }),
  );
}

/** Save a copy's posts (its composer's Save). A sent or deleted copy is locked: it throws. */
export async function updateCopyPosts(tx: SyncDb, ref: CopyRef, posts: PostCopyPost[]): Promise<void> {
  const [id] = await stored(tx, [ref]);
  const [copy] = await readByIds(tx, t, [id!]);
  if (copy!.sentAt !== null) throw new Error('This copy was sent: mark it as not sent to edit it');
  const parsed = postCopyCollection.schema.shape.posts.safeParse(posts);
  if (!parsed.success) throw new Error(`Invalid post_copies: ${parsed.error.issues[0]?.message ?? 'posts'}`);
  await repository.update(tx, id!, { posts: parsed.data });
}

/** Remove cards: a tombstone, so the channel's card stays away from the post. */
export async function removeCopies(tx: SyncDb, copies: CopyRef[]): Promise<void> {
  await repository.remove(tx, await stored(tx, copies));
}

/** Tombstone every live copy of these posts (removeThreads: a post's Delete). */
export async function removeCopiesOf(tx: SyncDb, postIds: string[]): Promise<void> {
  const live = await tx
    .select({ id: t.id })
    .from(t)
    .where(and(inJson(t.postId, postIds), isNull(t.deletedAt)));
  if (live.length > 0)
    await repository.remove(
      tx,
      live.map((copy) => copy.id),
    );
}

/** Mark cards sent at `sentAt`, or not sent (null). */
export async function setCopiesSent(tx: SyncDb, copies: CopyRef[], sentAt: number | null): Promise<void> {
  if (copies.length > 0) await repository.updateAll(tx, await stored(tx, copies), { sentAt });
}

/**
 * Bring a channel's card back to a post (Send to channels' +): its copy filled from the post and its
 * thread as they are now, unsent, reviving the removed one under `copyIdOf`. A live copy there is
 * left as it is.
 */
export async function addCopyFromPost(tx: SyncDb, postId: string, channelId: string): Promise<void> {
  const post = await readPost(tx, postId);
  if (!post) throw new Error('This post was deleted');
  const posts = postAsCopyPosts(post);
  const [removed] = await readByIds(tx, t, [copyIdOf(postId, channelId)]);
  if (removed && removed.postId === postId && removed.deletedAt !== null) await revive(tx, removed, { postId, posts });
  else await createCopy(tx, { postId, channelId, posts });
}

// The record under a copy's fixed id, live again as the post's copy with these posts, unsent.
async function revive(
  tx: SyncDb,
  previous: PostCopyRecord,
  { postId, posts }: Pick<PostCopyRecord, 'postId' | 'posts'>,
): Promise<PostCopyRecord> {
  const revived = nextVersion(previous, {
    postId,
    posts: postCopyCollection.schema.shape.posts.parse(posts),
    sentAt: null,
    deletedAt: null,
  });
  await saveRecords(tx, 'post_copies', t, [revived], { previous: [previous] });
  return revived;
}

/**
 * The channels removed from a post: those of its tombstoned copies, in one statement over
 * post_copies_post_idx. Here, not in sync/queries, because it is the one read of tombstones.
 */
export async function readRemovedChannelIds(db: SyncDb, postId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ channelId: t.channelId })
    .from(t)
    .where(and(eq(t.postId, postId), isNotNull(t.deletedAt)));
  return rows.map((row) => row.channelId);
}

// The cards' stored ids, storing an untouched one first as it shows (under its fixed id, which is its
// `id`). A removed card (on this or another device) throws: only + brings it back.
async function stored(tx: SyncDb, copies: CopyRef[]): Promise<string[]> {
  const rows = await readByIdMap(
    tx,
    t,
    copies.map((copy) => copy.id),
  );
  const ids: string[] = [];
  for (const copy of copies) {
    const found = rows.get(copy.id);
    const row = found?.postId === copy.postId ? found : await createCopy(tx, copy);
    if (row.deletedAt !== null) throw new Error('This copy was deleted');
    ids.push(row.id);
  }
  return ids;
}
