import { and, count, isNull, sql } from 'drizzle-orm';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import assetQuery from '@/sync/queries/assetQuery';

/**
 * How much of the library uses a contact: the photos it is tagged on (the contact's photos, as its
 * screen shows them) and the live posts whose text mentions it.
 */
export default async function readContactUses(
  db: SyncDb,
  contactId: string,
): Promise<{ photos: number; posts: number }> {
  const { count: photos } = await assetQuery({ scope: { contactId } }).read(db, { limit: 0 });
  const [row] = await db
    .select({ posts: count() })
    .from(schema.posts)
    .where(
      and(
        isNull(schema.posts.deletedAt),
        sql`exists (select 1 from json_each(${schema.posts.mentions}) where json_extract(value, '$.contactId') = ${contactId})`,
      ),
    );
  return { photos, posts: row?.posts ?? 0 };
}
