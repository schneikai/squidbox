import { resolveInstructions } from '@squidbox/shared';

import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The user's instructions, live: `stored`, their record (null before the first save, undefined while
 * reading), and `texts`, every kind's text as the assistant gets it (resolveInstructions), null while
 * reading.
 */
export default function useInstructions() {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  return { stored, texts: stored === undefined ? null : resolveInstructions(stored) };
}
