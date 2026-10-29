import { aiModelKindSchema, resolveModelDefaults } from '@squidbox/shared';
import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import usePersona from '@/hooks/usePersona';
import applyAiCatalog from '@/lib/applyAiCatalog';
import useLibrary from '@/library/useLibrary';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { clearPicksEqualTo, pickDefault as savePick, readModelPicks } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';
import setModelDefaultsAsync from '@/utils/cloud-api/ai/setModelDefaultsAsync';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `defaults` what everyone uses, `error` and `retry`), null until both
 * are in; `yourDefaults` the defaults this account uses, your picks over `defaults`, by kind and
 * variant like `defaults` (null while either loads); `usedId` the one the assistant uses now, the
 * default for the persona's Adult content switch (null while loading). `pickDefault(variant, model)`
 * picks your Default (`regular`) or Uncensored default (`unrestricted`) of the kind, null to follow
 * the published one; `publishDefaults()` is Make default for everyone: your two defaults of the kind
 * become everyone's, and the picks now equal to them are cleared (one changed during the request
 * stays). The picks sync with the account, the list stays on the device. On the first run the list
 * starts with the verified models Venice still has.
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
  const picks = useLiveQuery((db) => readModelPicks(db, userId), [schema.modelChoices], [userId]);

  useEffect(() => {
    if (!catalog || !defaults || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind, defaults)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, defaults, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(() => (catalog && list ? joinYourModels(list, catalog, kind) : null), [catalog, list, kind]);
  const yourDefaults = useMemo(
    () =>
      picks === undefined || !defaults
        ? null
        : Object.fromEntries(
            aiModelKindSchema.options.map((each) => [each, resolveModelDefaults(each, picks, defaults)]),
          ),
    [picks, defaults],
  );
  const usedId =
    yourDefaults && persona !== undefined
      ? yourDefaults[kind][persona?.adultContent ? 'unrestricted' : 'regular']
      : null;

  const pickDefault = useCallback(
    async (variant, model) => {
      await savePick(getDb(), userId, kind, variant, model, defaults[kind][variant]);
      requestSync();
    },
    [userId, kind, defaults],
  );

  async function publishDefaults() {
    const answer = await setModelDefaultsAsync(kind, yourDefaults[kind]);
    applyAiCatalog(answer);
    await clearPicksEqualTo(getDb(), userId, kind, answer.defaults[kind]);
    requestSync();
  }

  return { catalog, defaults, yourDefaults, error, retry, rows, usedId, pickDefault, publishDefaults };
}
