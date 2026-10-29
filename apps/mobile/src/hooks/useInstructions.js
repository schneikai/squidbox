import { resolveInstructions } from '@squidbox/shared';

import useHasFeature from '@/hooks/useHasFeature';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The user's instructions, live: `stored`, their record (null before the first save, undefined while
 * reading), and `texts`, every kind's text as the assistant gets it, null while reading. Editing them
 * is an ai_admin tool: only such an account's overrides apply (resolveInstructions), every other
 * account gets the defaults, as on the server, whatever it stored before.
 */
export default function useInstructions() {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const isAiAdmin = useHasFeature('ai_admin');
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  return { stored, texts: stored === undefined ? null : resolveInstructions(isAiAdmin ? stored : null) };
}
