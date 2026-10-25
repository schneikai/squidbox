import { useEffect, useMemo } from 'react';

import joinYourModels from './joinYourModels';
import seedModels from './seedModels';

import useAiCatalog from '@/hooks/useAiCatalog';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { useLiveQuery } from '@/sync/useLiveQuery';
import modelsOfKind from '@/utils/ai/modelsOfKind';

/**
 * Your models of a kind, live: `rows` your list joined with Venice's models (useAiCatalog's
 * `catalog`, `error` and `retry`), null until both are in; `chosenId` the one the assistant uses.
 * On the first run the list starts with the owner's picks that Venice still has.
 */
export default function useYourModels(kind) {
  const { models: catalog, error, retry } = useAiCatalog();
  // undefined while reading, null before the list was seeded
  const list = useLiveQuery(
    (db) => readModelList(db, kind),
    [schema.aiKinds, schema.aiModels, schema.aiScores],
    [kind],
  );

  useEffect(() => {
    if (!catalog || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(
    () => (catalog && list ? joinYourModels(list.models, catalog, kind) : null),
    [catalog, list, kind],
  );
  return { catalog, error, retry, rows, chosenId: list?.chosenId ?? null };
}
