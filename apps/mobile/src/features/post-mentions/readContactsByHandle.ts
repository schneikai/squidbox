import contactsByHandle from './contactsByHandle';
import type { MentionContact } from './mentionHandle';

import type { SyncDb } from '@/sync/db/types';
import contactQuery from '@/sync/queries/contactQuery';

/**
 * Every live contact, read once: by id (`contactsById`), and which of them a typed @handle means
 * (`ofHandle`, contactsByHandle).
 */
export default async function readContactsByHandle(db: SyncDb): Promise<{
  contactsById: ReadonlyMap<string, MentionContact>;
  ofHandle: ReturnType<typeof contactsByHandle>;
}> {
  const contacts = await contactQuery({}).summaries(db);
  return { contactsById: new Map(contacts.map((contact) => [contact.id, contact])), ofHandle: contactsByHandle(contacts) };
}
