import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import type { SyncDb } from '@/sync/db/types';
import contactQuery from '@/sync/queries/contactQuery';

/** The live contacts these posts' chips mention, by id (contactQuery's `ids` scope); none for no chips. */
export default async function readMentionContacts(
  db: SyncDb,
  posts: readonly MentionTextValue[],
): Promise<Map<string, MentionContact>> {
  const ids = [...new Set(posts.flatMap((post) => (post.mentions ?? []).map((mention) => mention.contactId)))];
  if (ids.length === 0) return new Map();
  const contacts = await contactQuery({ scope: { ids } }).summaries(db);
  return new Map(contacts.map((contact) => [contact.id, contact]));
}
