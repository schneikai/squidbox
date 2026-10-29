import { resolveModelId } from '@squidbox/shared';
import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import useLibrary from '@/library/useLibrary';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { readChosenModels, setChosenModel } from '@/sync/modelChoicesRepository';
import { readPersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `error` and `retry`), null until both are in; `chosenId` the one the
 * assistant uses (the default for the persona's Adult content switch while none is chosen, which
 * stays unstored; null while reading), `hasChoice` whether this account chose one, which `choose` changes (it syncs with the account; the list
 * stays on the device). On the first run the list starts with the verified models Venice still has.
 */
export default function useYourModels(kind) {
  const { models: catalog, defaults, error, retry } = useAiCatalog();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  // undefined while reading, null before the list was seeded
  const list = useLiveQuery(
    (db) => readModelList(db, kind),
    [schema.aiKinds, schema.aiModels, schema.aiScores],
    [kind],
  );
  const chosen = useLiveQuery((db) => readChosenModels(db, userId), [schema.modelChoices], [userId]);
  const persona = useLiveQuery((db) => readPersona(db, userId), [schema.personas], [userId]);

  useEffect(() => {
    if (!catalog || !defaults || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind, defaults)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, defaults, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(() => (catalog && list ? joinYourModels(list, catalog, kind) : null), [catalog, list, kind]);
  const choose = useCallback((model) => setChosenModel(getDb(), userId, kind, model), [userId, kind]);
  const chosenId =
    chosen === undefined || persona === undefined || !defaults
      ? null
      : resolveModelId(kind, chosen[kind], persona?.adultContent, defaults);
  const hasChoice = Boolean(chosen?.[kind]);
  return { catalog, error, retry, rows, chosenId, hasChoice, choose };
}
