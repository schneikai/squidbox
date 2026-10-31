import { and, isNull, max, sql, type SQL } from 'drizzle-orm';

import { albumAssetIdsOf } from './assetSql';
import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeEdgeRepository } from './edgesRepository';
import { makeRepository } from './repository';

const repository = makeRepository('posts', schema.posts);

/** The posts' asset references (the post_assets edge collection). */
export const postEdges = makeEdgeRepository('post_assets', schema.postAssets, 'postId');

export const { create, update, updateAll, remove } = repository;
export const toggleFavorite = (db: SyncDb, id: string) => repository.toggle(db, id, 'isFavorite');

/**
 * When a post comes up for a repost: its suggestion date, else its post date (a suggestion of 0 is
 * unset, as in drafts and older posts), else 0. `posts` is the posts table or an alias of it.
 */
export function repostDate(posts: typeof schema.posts = schema.posts): SQL<number> {
  return sql<number>`coalesce(nullif(${posts.suggestRepostAt}, 0), ${posts.postedAt}, 0)`;
}

/**
 * A thread is listed as its first post (sync-design §10): the id the post row `alias` (a name of the
 * posts table in the query) lists under, its thread's first post while that is live, else its own (a
 * first or standalone post, or a following post whose first post was deleted). Raw SQL over the
 * alias, so it reads the outer row in a select list too, where drizzle leaves columns unqualified.
 */
export function listedPostId(alias: string): SQL<string> {
  const row = sql.raw(alias);
  return sql<string>`coalesce((select r.id from posts r where r.id = ${row}.thread_root_id and r.deleted_at is null), ${row}.id)`;
}

/** Whether the post row `alias` is listed as itself: not a following post of a live first post. */
export function isListedPost(alias: string): SQL {
  return sql`${listedPostId(alias)} = ${sql.raw(alias)}.id`;
}

/**
 * The listed posts (listedPostId) of the live posts with a live edge to an asset `assetCondition`
 * (SQL on `asset_id`) picks: a photo in a following post finds its thread's first post.
 */
export function postsHoldingAssets(assetCondition: SQL): SQL {
  return sql`(select ${listedPostId('q')} from posts q where q.deleted_at is null and q.id in
    (select post_id from post_assets where ${assetCondition} and deleted_at is null))`;
}

/** The newest repost date among the listed live posts (isListedPost); 0 without any. */
export async function readNewestRepostDate(db: SyncDb): Promise<number> {
  const [row] = await db
    .select({ newest: max(repostDate()) })
    .from(schema.posts)
    .where(and(isNull(schema.posts.deletedAt), isListedPost('posts')));
  return Number(row?.newest ?? 0);
}

// The posts the chat reads its mentions from, at most.
const MENTION_POSTS = 100;

// The mention reads take every live post, a thread's following posts too: a handle the user wrote in
// one is still a handle they mentioned.

/**
 * The texts of the live posts whose assets share a live album with `assetIds` (through live edges),
 * newest post date first, at most MENTION_POSTS, with `fromAlbum: true`; without any (no album, or one never
 * posted from), the newest live posts, with `fromAlbum: false`. Where the chat finds the
 * handles the user mentions in posts like the one they write.
 */
export async function readMentionTexts(
  db: SyncDb,
  assetIds: string[],
): Promise<{ texts: string[]; fromAlbum: boolean }> {
  const p = schema.posts;
  const newest = sql`${p.postedAt} desc, ${p.id} desc`;
  const inAlbums = sql`${p.id} in (select pe.post_id from post_assets pe
    where pe.deleted_at is null and pe.asset_id in ${albumAssetIdsOf(assetIds)})`;
  const read = (where?: SQL) =>
    db
      .select({ text: p.text })
      .from(p)
      .where(where ? sql`${p.deletedAt} is null and ${where}` : isNull(p.deletedAt))
      .orderBy(newest)
      .limit(MENTION_POSTS);
  const fromAlbum = assetIds.length > 0 ? await read(inAlbums) : [];
  if (fromAlbum.length > 0) return { texts: fromAlbum.map((row) => row.text), fromAlbum: true };
  return { texts: (await read()).map((row) => row.text), fromAlbum: false };
}

/** The texts of every live post with an @, newest post date first: the handles the user ever mentioned. */
export async function readMentionedTexts(db: SyncDb): Promise<string[]> {
  const p = schema.posts;
  const rows = await db
    .select({ text: p.text })
    .from(p)
    .where(sql`${p.deletedAt} is null and instr(${p.text}, '@') > 0`)
    .orderBy(sql`${p.postedAt} desc, ${p.id} desc`);
  return rows.map((row) => row.text);
}
