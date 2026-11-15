import { and, isNull } from 'drizzle-orm';

import type { MentionContact } from './mentionHandle';
import type { MentionTextValue } from './mentionParts';

import * as schema from '@/sync/db/schema';
import type { SyncDb } from '@/sync/db/types';
import { inJson } from '@/sync/inJson';

const c = schema.contacts;

// What a chip reads of its contact (MentionContact): no notes, places or phone number.
const COLUMNS = {
  id: c.id,
  name: c.name,
  avatarFilename: c.avatarFilename,
  isFavorite: c.isFavorite,
  xHandle: c.xHandle,
  blueskyHandle: c.blueskyHandle,
  onlyFansHandle: c.onlyFansHandle,
  jffHandle: c.jffHandle,
  instagramHandle: c.instagramHandle,
} satisfies Record<keyof Required<MentionContact>, unknown>;

/** The live contacts these posts' chips mention, by id, in one statement (none for no chips). */
export default async function readMentionContacts(
  db: SyncDb,
  posts: readonly MentionTextValue[],
): Promise<Map<string, MentionContact>> {
  const ids = [...new Set(posts.flatMap((post) => (post.mentions ?? []).map((mention) => mention.contactId)))];
  if (ids.length === 0) return new Map();
  const contacts = await db
    .select(COLUMNS)
    .from(c)
    .where(and(isNull(c.deletedAt), inJson(c.id, ids)));
  return new Map(contacts.map((contact) => [contact.id, contact]));
}
