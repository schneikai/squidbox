import { resolveInstructions } from '@squidbox/shared';

import useAiCatalog from '@/hooks/useAiCatalog';
import useHasFeature from '@/hooks/useHasFeature';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readInstructions } from '@/sync/instructionsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The user's instructions, live: `stored`, their record (null before the first save, undefined while
 * reading); `defaultTexts`, the app's default of every kind (the published text, else the built-in
 * one; null until the catalog is in); and `texts`, every kind's text as the assistant gets it, null
 * until both are in. Editing them is an ai_admin tool: only such an account's overrides apply
 * (resolveInstructions), every other account gets the app's defaults, as on the server, whatever it
 * stored before. `error` and `retry` are the catalog's (useAiCatalog).
 */
export default function useInstructions() {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const isAiAdmin = useHasFeature('ai_admin');
  const { instructions: defaultTexts, error, retry } = useAiCatalog();
  const stored = useLiveQuery((db) => readInstructions(db, userId), [schema.instructions], [userId]);
  const texts =
    stored === undefined || !defaultTexts ? null : resolveInstructions(isAiAdmin ? stored : null, defaultTexts);
  return { stored, defaultTexts, texts, error, retry };
}
