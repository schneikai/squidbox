import { and, eq, exists, isNotNull, isNull, or } from 'drizzle-orm';

import { MENTION_HANDLES, type MentionContact } from './mentionSuggestions';

import { schema } from '@/sync/db/client';
import { inJson } from '@/sync/inJson';
import { useLiveQuery } from '@/sync/useLiveQuery';

const c = schema.contacts;
const l = schema.contactLinks;

/**
 * The live contacts with a handle to mention (MENTION_HANDLES), each saying whether it is on one of
 * the photos `assetIds` (`isOnPhotos`), live; undefined while reading.
 */
export default function useMentionContacts(assetIds: string[]): MentionContact[] | undefined {
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
          isOnPhotos: exists(
            db
              .select({ id: l.id })
              .from(l)
              .where(
                and(
                  eq(l.contactId, c.id),
                  eq(l.targetType, 'asset'),
                  inJson(l.targetId, assetIds),
                  isNull(l.deletedAt),
                ),
              ),
          ).mapWith(Boolean),
        })
        .from(c)
        .where(and(isNull(c.deletedAt), or(...MENTION_HANDLES.map(({ field }) => isNotNull(c[field]))))),
    [schema.contacts, schema.contactLinks],
    [assetIds],
  );
}
