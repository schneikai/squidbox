import type { MentionTextValue } from './mentionParts';
import postHandles from './postHandles';
import readMentionContacts from './readMentionContacts';

import type { SyncDb } from '@/sync/db/types';

/** The @handles these posts mention (postHandles), with their chips' contacts read live in one statement. */
export default async function readPostHandles(db: SyncDb, posts: readonly MentionTextValue[]): Promise<string[]> {
  return postHandles(posts, await readMentionContacts(db, posts));
}
