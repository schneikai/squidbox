import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import useChosenModels from '@/hooks/useChosenModels';
import usePersona from '@/hooks/usePersona';
import useLibrary from '@/library/useLibrary';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { setChosenModel } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `defaults`, `error` and `retry`), null until both are in; `chosenId`
 * the one the assistant uses (useChosenModels' `usedId`); `hasChoice` whether this account chose
 * one, which `choose` changes (the choice syncs with the account, the list stays on the device). On
 * the first run the list starts with the verified models Venice still has.
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
  const persona = usePersona();
  const { chosen, usedId } = useChosenModels(persona, defaults);

  useEffect(() => {
    if (!catalog || !defaults || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind, defaults)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, defaults, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(() => (catalog && list ? joinYourModels(list, catalog, kind) : null), [catalog, list, kind]);
  const choose = useCallback((model) => setChosenModel(getDb(), userId, kind, model), [userId, kind]);
  const chosenId = usedId(kind);
  const hasChoice = Boolean(chosen?.[kind]);
  return { catalog, defaults, error, retry, rows, chosenId, hasChoice, choose };
}
