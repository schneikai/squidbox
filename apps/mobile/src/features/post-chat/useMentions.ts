import readMentions from './readMentions';

import { MIN_REREAD_INTERVAL } from '@/constants';
import { schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The @handles a post of these assets may mention (readMentions), live; undefined while reading. */
export default function useMentions(assetIds: string[]) {
  return useLiveQuery(
    (db) => readMentions(db, assetIds),
    [
      schema.posts,
      schema.postAssets,
      schema.albumAssets,
      schema.albums,
      schema.contacts,
      schema.contactLinks,
      schema.assets,
    ],
    [assetIds],
    { minInterval: MIN_REREAD_INTERVAL },
  );
}

export type Mentions = NonNullable<ReturnType<typeof useMentions>>;
