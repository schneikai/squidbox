import readMentions from './readMentions';
import type { ListEdits } from './withEdits';

import { MIN_REREAD_INTERVAL } from '@/constants';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The contacts the chat about these assets may mention, with the Mentions sheet's edits
 * (`mentionEdits`; readMentions), live; undefined while reading.
 */
export default function useMentions(assetIds: string[], mentionEdits: ListEdits | undefined) {
  return useLiveQuery(
    async (db) => (mentionEdits ? readMentions(db, assetIds, mentionEdits) : undefined),
    [
      schema.posts,
      schema.postAssets,
      schema.albumAssets,
      schema.albums,
      schema.contacts,
      schema.contactLinks,
      schema.assets,
    ],
    [assetIds, mentionEdits],
    { minInterval: MIN_REREAD_INTERVAL },
  );
}

export type Mentions = NonNullable<ReturnType<typeof useMentions>>;
