import { resolveInstructions } from '@squidbox/shared';

import useHasFeature from '@/hooks/useHasFeature';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The user's instructions, live: `stored`, their record (null before the first save, undefined while
 * reading), and `texts`, every kind's text as the assistant gets it (resolveInstructions: their own
 * App prompts only for an ai_admin account), null while reading.
 */
export default function useInstructions() {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const isAiAdmin = useHasFeature('ai_admin');
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  return { stored, texts: stored === undefined ? null : resolveInstructions(stored, { isAiAdmin }) };
}
