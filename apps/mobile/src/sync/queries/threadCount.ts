import { sql } from 'drizzle-orm';

/**
 * A post's live following posts, counted over posts_thread_idx, as a field of a select from posts
 * aliased `p`. `p.id` is spelled out: drizzle leaves a selected field's columns unqualified, which
 * inside the subquery would name `c.id`.
 */
const threadCount = sql`(select count(*) from posts c where c.thread_root_id = p.id and c.deleted_at is null)`
  .mapWith(Number)
  .as('thread_count');

export default threadCount;
