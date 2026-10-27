import { isNull, max, sql, type SQL } from 'drizzle-orm';

import { albumsOfAssets } from './assetSql';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

const repository = makeRepository('posts', schema.posts);

export const { create, update, remove } = repository;
export const toggleFavorite = (db: SyncDb, id: string) => repository.toggle(db, id, 'isFavorite');

/**
 * When a post comes up for a repost: its suggestion date, else its post date (a suggestion of 0 is
 * unset, as in drafts and older posts), else 0. `posts` is the posts table or an alias of it.
 */
export function repostDate(posts: typeof schema.posts = schema.posts): SQL<number> {
  return sql<number>`coalesce(nullif(${posts.suggestRepostAt}, 0), ${posts.postedAt}, 0)`;
}

/** The newest repost date among the non-deleted posts; 0 without any. */
export async function readNewestRepostDate(db: SyncDb): Promise<number> {
  const [row] = await db
    .select({ newest: max(repostDate()) })
    .from(schema.posts)
    .where(isNull(schema.posts.deletedAt));
  return Number(row?.newest ?? 0);
}

/**
 * The texts of the live posts whose assets share a live album with `assetIds` (through live edges),
 * newest post date first, at most `limit`, with `fromAlbum: true`; without any (no album, or one never
 * posted from), the newest `limit` live posts, with `fromAlbum: false`. Where the chat finds the
 * handles the user mentions in posts like the one they write.
 */
export async function readMentionTexts(
  db: SyncDb,
  assetIds: string[],
  limit = 100,
): Promise<{ texts: string[]; fromAlbum: boolean }> {
  const p = schema.posts;
  const newest = sql`${p.postedAt} desc, ${p.id} desc`;
  const inAlbums = sql`${p.id} in (select pe.post_id from post_assets pe where pe.deleted_at is null and pe.asset_id in (
    select aa.asset_id from album_assets aa join albums al on al.id = aa.album_id and al.deleted_at is null
    where aa.deleted_at is null and aa.album_id in ${albumsOfAssets(assetIds)}))`;
  const read = (where?: SQL) =>
    db
      .select({ text: p.text })
      .from(p)
      .where(where ? sql`${p.deletedAt} is null and ${where}` : isNull(p.deletedAt))
      .orderBy(newest)
      .limit(limit);
  const fromAlbum = assetIds.length > 0 ? await read(inAlbums) : [];
  if (fromAlbum.length > 0) return { texts: fromAlbum.map((row) => row.text), fromAlbum: true };
  return { texts: (await read()).map((row) => row.text), fromAlbum: false };
}
