import { useMemo } from 'react';

import extractHandles from './extractHandles';

import { MIN_REREAD_INTERVAL } from '@/constants';
import { schema } from '@/sync/db/client';
import { readMentionedTexts } from '@/sync/postsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** Every @handle the user ever mentioned in a post, those used most first; undefined while reading. */
export default function useMentionedHandles() {
  const texts = useLiveQuery(readMentionedTexts, [schema.posts], [], { minInterval: MIN_REREAD_INTERVAL });
  return useMemo(() => texts && extractHandles(texts), [texts]);
}
