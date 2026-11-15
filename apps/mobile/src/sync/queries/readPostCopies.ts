import type { PostCopyPost } from '@squidbox/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { AssetRow, PostCopyRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readByIdMap } from '@/sync/readByIds';

/** One post of a copy, with its assets in order (a purged one left out, as a post shows them). */
export type PostCopyPostWithAssets = Pick<PostCopyPost, 'text' | 'mentions'> & { assets: AssetRow[] };

/** A post's channel copy as Send to channels shows it: its record, each post with its assets. */
export type PostCopyWithAssets = Omit<PostCopyRow, 'posts'> & { posts: PostCopyPostWithAssets[] };

/** The tables a read of a post's copies watches. */
export const postCopiesTables = [schema.postCopies, schema.assets];

/**
 * A post's live copies in the order they were added (`(createdAt, id)`), each post with its assets in
 * order, read in one asset statement. An id that no longer resolves, or a purged asset, is left out
 * (assetDeletionWhere's post rule: a trashed one still shows, it can come back).
 */
export default async function readPostCopies(db: SyncDb, postId: string): Promise<PostCopyWithAssets[]> {
  const t = schema.postCopies;
  const copies = await db
    .select()
    .from(t)
    .where(and(eq(t.postId, postId), isNull(t.deletedAt)))
    .orderBy(asc(t.createdAt), asc(t.id));
  const ids = copies.flatMap((copy) => copy.posts.flatMap((post) => post.assetIds));
  const assets = await readByIdMap(db, schema.assets, ids);
  return copies.map((copy) => ({
    ...copy,
    posts: copy.posts.map(({ text, mentions, assetIds }) => ({
      text,
      mentions,
      assets: assetIds.flatMap((id) => {
        const asset = assets.get(id);
        return asset && asset.purgedAt === null ? [asset] : [];
      }),
    })),
  }));
}
