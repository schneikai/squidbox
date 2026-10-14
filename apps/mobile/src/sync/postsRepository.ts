import { desc, isNull, max, sql } from 'drizzle-orm';

import * as schema from './db/schema';
import type { SyncDb } from './db/types';
import { makeRepository } from './repository';

const repository = makeRepository('posts', schema.posts);

export const createPost = repository.create;
export const updatePost = repository.update;
export const deletePosts = repository.remove;
export const toggleFavorite = (db: SyncDb, id: string) => repository.toggle(db, id, 'isFavorite');

/** The non-empty texts of the non-deleted posts, newest first (the AI's style reference). */
export async function readPostTexts(db: SyncDb): Promise<string[]> {
  const rows = await db
    .select({ text: schema.posts.text })
    .from(schema.posts)
    .where(isNull(schema.posts.deletedAt))
    .orderBy(desc(schema.posts.createdAt), desc(schema.posts.id));
  return rows.map((row) => row.text.trim()).filter(Boolean);
}

/** The newest repost suggestion or post date among the non-deleted posts; 0 without any. */
export async function readNewestRepostDate(db: SyncDb): Promise<number> {
  const [row] = await db
    .select({
      newest: max(sql<number>`coalesce(nullif(${schema.posts.suggestRepostAt}, 0), ${schema.posts.postedAt}, 0)`),
    })
    .from(schema.posts)
    .where(isNull(schema.posts.deletedAt));
  return Number(row?.newest ?? 0);
}
