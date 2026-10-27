import { useMemo } from 'react';

import extractHandles from './extractHandles';

import { MIN_REREAD_INTERVAL } from '@/constants';
import { schema } from '@/sync/db/client';
import { readMentionTexts } from '@/sync/postsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The @handles the user mentions in posts like the one with these assets: those of the posts of the
 * assets' albums (`fromAlbum`), else of their newest posts; undefined while reading.
 */
export default function useMentions(assetIds) {
  const result = useLiveQuery(
    (db) => readMentionTexts(db, assetIds),
    [schema.posts, schema.postAssets, schema.albumAssets, schema.albums],
    [assetIds],
    { minInterval: MIN_REREAD_INTERVAL },
  );
  return useMemo(() => result && { handles: extractHandles(result.texts), fromAlbum: result.fromAlbum }, [result]);
}
