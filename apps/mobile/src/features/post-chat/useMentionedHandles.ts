import { MIN_REREAD_INTERVAL } from '@/constants';
import readPostHandles from '@/features/post-mentions/readPostHandles';
import { schema } from '@/sync/db/client';
import { readMentionedTexts } from '@/sync/postsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * Every @handle the user ever mentioned in a post, those used most first, a chip's contact's handles
 * too (postHandles); undefined while reading.
 */
export default function useMentionedHandles() {
  return useLiveQuery(
    async (db) => readPostHandles(db, await readMentionedTexts(db)),
    [schema.posts, schema.contacts],
    [],
    { minInterval: MIN_REREAD_INTERVAL },
  );
}
