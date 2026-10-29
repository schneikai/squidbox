import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import useChosenModels from '@/hooks/useChosenModels';
import usePersona from '@/hooks/usePersona';
import useLibrary from '@/library/useLibrary';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { pickDefault as savePick } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `defaults` what everyone uses, `error` and `retry`), null until both
 * are in; `yourDefaults` the defaults this account uses, your picks over `defaults`
 * (useChosenModels'); `usedId` the one the assistant uses now; `pickDefault(variant, model)` picks
 * your Default (`regular`) or Uncensored default (`unrestricted`) of the kind, null to follow the
 * published one (the picks sync with the account, the list stays on the device). On the first run
 * the list starts with the verified models Venice still has.
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
  const { yourDefaults, usedId } = useChosenModels(persona, defaults);

  useEffect(() => {
    if (!catalog || !defaults || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind, defaults)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, defaults, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(() => (catalog && list ? joinYourModels(list, catalog, kind) : null), [catalog, list, kind]);
  const pickDefault = useCallback(
    async (variant, model) => {
      await savePick(getDb(), userId, kind, variant, model, defaults[kind][variant]);
      requestSync();
    },
    [userId, kind, defaults],
  );
  return { catalog, defaults, yourDefaults, error, retry, rows, usedId: usedId(kind), pickDefault };
}
