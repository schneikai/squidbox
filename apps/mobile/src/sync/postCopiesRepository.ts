import { postCopyCollection, type PostCopyPost, type PostCopyRecord } from '@squidbox/shared';
import { and, eq, isNull } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { readByIds } from './readByIds';
import { makeRepository } from './repository';

import newRecord from '@/utils/newRecord';

// A post's channel copies (Send to channels, sync-design §10): the only writer of the post_copies
// table. Every function writes inside the caller's transaction, so a user action commits at once.

const repository = makeRepository('post_copies', schema.postCopies);

/** A new copy of `postId` for `channelId`, unsent. Its posts over a limit throw the schema's message. */
export function createCopy(
  tx: SyncDb,
  { postId, channelId, posts }: Pick<PostCopyRecord, 'postId' | 'channelId' | 'posts'>,
): Promise<PostCopyRecord> {
  return repository.create(tx, newRecord(postCopyCollection, {}, { postId, channelId, posts, sentAt: null }));
}

/** Save a copy's posts (its composer's Save). A sent or deleted copy is locked: it throws. */
export async function updateCopyPosts(tx: SyncDb, id: string, posts: PostCopyPost[]): Promise<void> {
  const [copy] = await readByIds(tx, schema.postCopies, [id]);
  if (!copy || copy.deletedAt !== null) throw new Error('This copy was deleted');
  if (copy.sentAt !== null) throw new Error('This copy was sent: mark it as not sent to edit it');
  const parsed = postCopyCollection.schema.shape.posts.safeParse(posts);
  if (!parsed.success) throw new Error(`Invalid post_copies: ${parsed.error.issues[0]?.message ?? 'posts'}`);
  await repository.update(tx, id, { posts: parsed.data });
}

/** Tombstone copies, by id. */
export function removeCopies(tx: SyncDb, ids: string[]): Promise<void> {
  return repository.remove(tx, ids);
}

/** Tombstone every live copy of a post (its Delete). */
export async function removeCopiesOf(tx: SyncDb, postId: string): Promise<void> {
  const t = schema.postCopies;
  const live = await tx
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.postId, postId), isNull(t.deletedAt)));
  if (live.length > 0)
    await repository.remove(
      tx,
      live.map((copy) => copy.id),
    );
}

/** Mark copies sent at `sentAt`, or not sent (null). */
export async function setCopiesSent(tx: SyncDb, ids: string[], sentAt: number | null): Promise<void> {
  if (ids.length > 0) await repository.updateAll(tx, ids, { sentAt });
}
