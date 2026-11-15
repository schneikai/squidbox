import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { readByIds } from '@/sync/readByIds';

/** The live contacts these posts' chips mention, by id, read in one statement. */
export default async function readMentionContacts(
  db: SyncDb,
  posts: readonly MentionTextValue[],
): Promise<Map<string, MentionContact>> {
  const ids = posts.flatMap((post) => (post.mentions ?? []).map((mention) => mention.contactId));
  const contacts = (await readByIds(db, schema.contacts, ids)).filter((contact) => contact.deletedAt === null);
  return new Map(contacts.map((contact) => [contact.id, contact]));
}
