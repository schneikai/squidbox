import type { PostCopyPost } from '@squidbox/shared';
import { and, asc, count, eq, isNull } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { AssetRow, PostCopyRow } from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import assetQuery from '@/sync/queries/assetQuery';

/**
 * One post of a copy as it shows and sends: its text and mentions, its assets in order and their ids
 * (`assetIds`), a purged or unknown one left out of both.
 */
export type PostCopyPostWithAssets = PostCopyPost & { assets: AssetRow[] };

/** A post's channel copy as Send to channels shows it: its record, each post with its assets. */
export type PostCopyWithAssets = Omit<PostCopyRow, 'posts'> & { posts: PostCopyPostWithAssets[] };

/** The tables a read of a post's copies watches. */
export const postCopiesTables = [schema.postCopies, schema.assets];

/**
 * A post's live copies in the order they were added (`(createdAt, id)`), each post with its assets in
 * order, read in one asset statement. An asset a post would
 * leave out (assetQuery's post scope: a purged one; a trashed one still shows, it can come back), or an
 * id that no longer resolves, is left out.
 */
export default async function readPostCopies(db: SyncDb, postId: string): Promise<PostCopyWithAssets[]> {
  const t = schema.postCopies;
  const copies = await db
    .select()
    .from(t)
    .where(and(eq(t.postId, postId), isNull(t.deletedAt)))
    .orderBy(asc(t.createdAt), asc(t.id));
  const ids = [...new Set(copies.flatMap((copy) => copy.posts.flatMap((post) => post.assetIds)))];
  // What a post keeps of its assets is assetQuery's post scope (assetDeletionWhere): a copy keeps the same.
  const rows = ids.length > 0 ? await assetQuery({ scope: { postId } }).rowsByIds(db, ids) : [];
  const assets = new Map(rows.map((asset) => [asset.id, asset]));
  return copies.map((copy) => ({
    ...copy,
    posts: copy.posts.map(({ text, mentions, assetIds }) => {
      const shown = assetIds.flatMap((id) => {
        const asset = assets.get(id);
        return asset ? [asset] : [];
      });
      return { text, mentions, assetIds: shown.map((asset) => asset.id), assets: shown };
    }),
  }));
}

/** How many live copies a post has, in one statement over post_copies_post_idx. */
export async function countPostCopies(db: SyncDb, postId: string): Promise<number> {
  const t = schema.postCopies;
  const [row] = await db
    .select({ count: count() })
    .from(t)
    .where(and(eq(t.postId, postId), isNull(t.deletedAt)));
  return row?.count ?? 0;
}
