import postHandles, { type PostWithMentions } from './postHandles';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readByIds } from '@/sync/readByIds';

/** The @handles these posts mention (postHandles), with their chips' contacts read live in one statement. */
export default async function readPostHandles(db: SyncDb, posts: readonly PostWithMentions[]): Promise<string[]> {
  const ids = posts.flatMap((post) => (post.mentions ?? []).map((mention) => mention.contactId));
  const contacts = (await readByIds(db, schema.contacts, ids)).filter((contact) => contact.deletedAt === null);
  return postHandles(posts, new Map(contacts.map((contact) => [contact.id, contact])));
}
