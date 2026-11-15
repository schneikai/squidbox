import chipContactIds from './chipContactIds';
import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import type { SyncDb } from '@/sync/db/types';
import contactQuery from '@/sync/queries/contactQuery';

/**
 * The live contacts these posts' chips mention, and those of `moreIds`, by id (contactQuery's `ids`
 * scope, one statement); none for no ids.
 */
export default async function readMentionContacts(
  db: SyncDb,
  posts: readonly MentionTextValue[],
  moreIds: readonly string[] = [],
): Promise<Map<string, MentionContact>> {
  const ids = [...new Set([...chipContactIds(posts), ...moreIds])];
  if (ids.length === 0) return new Map();
  const contacts = await contactQuery({ scope: { ids } }).summaries(db);
  return new Map(contacts.map((contact) => [contact.id, contact]));
}
