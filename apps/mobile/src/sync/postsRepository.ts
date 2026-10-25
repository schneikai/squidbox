import { and, desc, isNull, max, ne, sql, type SQL } from 'drizzle-orm';

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

/** The texts of the newest `limit` non-deleted posts that have one, newest first ("Fill it in for me"). */
export async function readRecentPostTexts(db: SyncDb, limit: number): Promise<string[]> {
  const rows = await db
    .select({ text: schema.posts.text })
    .from(schema.posts)
    .where(and(isNull(schema.posts.deletedAt), ne(sql`trim(${schema.posts.text})`, '')))
    .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id))
    .limit(limit);
  return rows.map((row) => row.text.trim());
}
