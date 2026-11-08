import { and, isNotNull, isNull, or } from 'drizzle-orm';

import { MENTION_HANDLES, type MentionContact } from './mentionSuggestions';

import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

const c = schema.contacts;

/** The live contacts with a handle to mention (MENTION_HANDLES), live; undefined while reading. */
export default function useMentionContacts(): MentionContact[] | undefined {
  return useLiveQuery(
    (db) =>
      db
        .select({
          id: c.id,
          name: c.name,
          isFavorite: c.isFavorite,
          avatarFilename: c.avatarFilename,
          xHandle: c.xHandle,
          instagramHandle: c.instagramHandle,
          blueskyHandle: c.blueskyHandle,
        })
        .from(c)
        .where(and(isNull(c.deletedAt), or(...MENTION_HANDLES.map(({ field }) => isNotNull(c[field]))))),
    [schema.contacts],
  );
}
