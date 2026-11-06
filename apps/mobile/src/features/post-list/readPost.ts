import postQuery, { type PostDetailRow } from './postQuery';

import type { SyncDb } from '@/sync/db/types';

/** One post with its `postAssets`, or `null` when it doesn't exist. */
export default async function readPost(db: SyncDb, postId: string): Promise<PostDetailRow | null> {
  const rows = await postQuery({ scope: { postId } }).readRows(db, { limit: 1 });
  return rows[0] ?? null;
}
