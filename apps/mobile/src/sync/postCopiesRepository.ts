import { postCopyCollection, type PostCopyPost, type PostCopyRecord } from '@squidbox/shared';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

import { nextVersion } from './clock';
import * as schema from './db/schema';
import type { PostCopyRow } from './db/schema';
import type { SyncDb } from './db/types';
import { inJson } from './inJson';
import { readByIdMap } from './readByIds';
import { makeRepository } from './repository';
import { saveRecords } from './saveRecords';

import uuidV5 from '@/lib/uuidV5';
import getTimestamp from '@/utils/date-time/getTimestamp';
import newRecord from '@/utils/newRecord';

// A post's channel copies (Send to channels, sync-design §10): the only writer of the post_copies
// table. Every function writes inside the caller's transaction, so a user action commits at once.
// A card without a live record (untouched) is not stored (readChannelCopies builds it from the
// post): a write on it stores it with the write, as it shows, under its fixed id (`copyIdOf`).

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
 * Whether a stored copy shows the post as it is now, like an untouched card: unsent and never saved
 * in its composer. A sent copy shows what was sent; a saved one is the channel's own.
 */
export function followsPost(copy: Pick<PostCopyRow, 'sentAt' | 'editedAt'>): boolean {
  return copy.sentAt === null && copy.editedAt == null;
}

/**
 * A copy of `postId` for `channelId` (a repost's), unsent, under `copyIdOf`; `editedAt` when it is a
 * copy the user saved. A live copy there is kept as it is. Its posts over a limit throw the schema's
 * message. `createdAt` (now without it) orders the copies of channels no longer in the user's
 * channels: copies made together pass one each, in order, so they list in that order.
 */
export async function createCopy(
  tx: SyncDb,
  {
    postId,
    channelId,
    posts,
    editedAt = null,
    createdAt,
  }: Pick<PostCopyRecord, 'postId' | 'channelId' | 'posts' | 'editedAt'> & { createdAt?: number },
): Promise<void> {
  const card = { id: copyIdOf(postId, channelId), postId, channelId, posts };
  const made = createdAt === undefined ? {} : { createdAt, updatedAt: createdAt };
  await writeCards(tx, [card], (row) => (row ? null : { editedAt, ...made }));
}

/**
 * Save a card's posts (its composer's Save): the channel's own copy from then on. A sent copy is
 * locked, and a removed one is gone: both throw.
 */
export async function updateCopyPosts(tx: SyncDb, copy: CopyRef, posts: PostCopyPost[]): Promise<void> {
  await writeCards(tx, [copy], (row) => {
    if (row?.sentAt != null) throw new Error('This copy was sent: mark it as not sent to edit it');
    return { posts: parsePosts(posts), editedAt: getTimestamp() };
  });
}

/** Take cards' channels off the post (Remove): no card shows for them until + (`restoreCopies`). */
export async function removeCopies(tx: SyncDb, copies: CopyRef[]): Promise<void> {
  await writeCards(tx, copies, () => ({ removedAt: getTimestamp() }));
}

/**
 * Mark cards sent at `sentAt` (a card that follows the post with the posts it showed, what was
 * sent), or not sent (null: a copy never saved then follows the post again).
 */
export async function setCopiesSent(tx: SyncDb, copies: CopyRef[], sentAt: number | null): Promise<void> {
  await writeCards(tx, copies, (row, copy) =>
    sentAt !== null && row && followsPost(row) ? { sentAt, posts: parsePosts(copy.posts) } : { sentAt },
  );
}

/**
 * Bring a channel's card back to a post (Send to channels' +): its removed copies are shown again,
 * one never saved following the post.
 */
export async function restoreCopies(tx: SyncDb, postId: string, channelId: string): Promise<void> {
  const removed = await tx
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.postId, postId), eq(t.channelId, channelId), isNull(t.deletedAt), isNotNull(t.removedAt)));
  if (removed.length > 0)
    await repository.updateAll(
      tx,
      removed.map((copy) => copy.id),
      { removedAt: null },
    );
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

/**
 * Writes `changesOf(row, card)` to each card's record, as one new version: a card without a live
 * record (untouched; a tombstone under its fixed id, too) is stored with them, as it shows, unsent.
 * `changesOf` gets the live record (undefined for an untouched card) and returns null to write
 * nothing. A card removed meanwhile (on this or another device) throws.
 */
async function writeCards(
  tx: SyncDb,
  cards: CopyRef[],
  changesOf: (row: PostCopyRow | undefined, card: CopyRef) => Partial<PostCopyRecord> | null,
): Promise<void> {
  const rows = await readByIdMap(
    tx,
    t,
    cards.map((card) => card.id),
  );
  const created: PostCopyRecord[] = [];
  const updated: PostCopyRecord[] = [];
  const previous: PostCopyRow[] = [];
  for (const card of cards) {
    const row = rows.get(card.id);
    const live = row?.deletedAt === null ? row : undefined;
    if (live?.removedAt != null) throw new Error('This copy was deleted');
    const changes = changesOf(live, card);
    if (!changes) continue;
    if (live) {
      updated.push(nextVersion<PostCopyRecord>(live, changes));
      previous.push(live);
      continue;
    }
    const { id, postId, channelId, posts } = card;
    const fresh = { postId, channelId, posts: parsePosts(posts), sentAt: null, editedAt: null, removedAt: null };
    if (row) {
      updated.push(nextVersion<PostCopyRecord>(row, { ...fresh, deletedAt: null, ...changes }));
      previous.push(row);
    } else created.push(newRecord(postCopyCollection, {}, { id, ...fresh, ...changes }));
  }
  if (created.length > 0) await repository.createMany(tx, created);
  if (updated.length > 0) await saveRecords(tx, 'post_copies', t, updated, { previous });
}

// A copy's posts as the record holds them (a card's `assets` dropped); over a limit, the schema's message.
function parsePosts(posts: PostCopyPost[]): PostCopyPost[] {
  const parsed = postCopyCollection.schema.shape.posts.safeParse(posts);
  if (!parsed.success) throw new Error(`Invalid post_copies: posts: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  return parsed.data;
}
