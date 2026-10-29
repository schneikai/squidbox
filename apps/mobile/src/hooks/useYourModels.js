import { MODEL_CHOICE_FIELDS, MODEL_DEFAULT_VARIANTS } from '@squidbox/shared';
import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import usePersona from '@/hooks/usePersona';
import useYourDefaults from '@/hooks/useYourDefaults';
import applyAiCatalog from '@/lib/applyAiCatalog';
import useLibrary from '@/library/useLibrary';
import { readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { clearPicks, clearPicksEqualTo, pickDefault as savePick, readModelPicks } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';
import setModelDefaultsAsync from '@/utils/cloud-api/ai/setModelDefaultsAsync';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `error` and `retry`; `defaults` what everyone uses), null until both
 * are in; `yourDefaults` the defaults this account uses, your picks over `defaults`, by kind and
 * variant like `defaults` (null while either loads), and `isChanged` whether they differ from
 * `defaults` for this kind (useYourDefaults'); `usedId` the one the assistant uses now, the default
 * for the persona's Adult content switch (null while loading). `pickDefault(variant, model)` picks
 * your Default (`regular`) or Uncensored default (`unrestricted`) of the kind, null to follow the
 * published one; `publishDefaults()` is Apply changes for everyone: your two defaults of the kind
 * become everyone's, and the picks now equal to them are cleared (one changed during the request
 * stays); `resetDefaults()` clears both picks of the kind, back to the published defaults. The
 * picks sync with the account, the list stays on the device. On the first run the list starts with
 * the verified models Venice still has.
 */
export default function useYourModels(kind) {
  const { models: catalog, error, retry } = useAiCatalog();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  // undefined while reading, null before the list was seeded
  const list = useLiveQuery(
    (db) => readModelList(db, kind),
    [schema.aiKinds, schema.aiModels, schema.aiScores],
    [kind],
  );
  const persona = usePersona();
  const { defaults, yourDefaults, changedKinds } = useYourDefaults();

  useEffect(() => {
    if (!catalog || !defaults || list !== null) return;
    seedYourModels(getDb(), kind, seedModels(modelsOfKind(catalog, kind), kind, defaults)).catch((error) =>
      console.error('Seeding your models failed', error),
    );
  }, [catalog, defaults, list]);

  // Memoized: the Add screen's rows stay memoized across its search keystrokes.
  const rows = useMemo(() => (catalog && list ? joinYourModels(list, catalog, kind) : null), [catalog, list, kind]);
  const isChanged = changedKinds?.includes(kind) ?? false;
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

  // The server keeps the published default of a variant without a pick, so one another admin
  // published meanwhile stays. A failing local clean-up after a done publish is only logged.
  async function publishDefaults() {
    const picks = await readModelPicks(getDb(), userId);
    const fields = MODEL_CHOICE_FIELDS[kind];
    const answer = await setModelDefaultsAsync(
      kind,
      Object.fromEntries(MODEL_DEFAULT_VARIANTS.map((variant) => [variant, picks[fields[variant]]?.id ?? null])),
    );
    applyAiCatalog(answer);
    try {
      await clearPicksEqualTo(getDb(), userId, kind, answer.defaults[kind]);
      requestSync();
    } catch (cleanUpError) {
      console.error('Clearing the published picks failed', cleanUpError);
    }
  }

  async function resetDefaults() {
    await clearPicks(getDb(), userId, kind);
    requestSync();
  }

  return {
    catalog,
    defaults,
    yourDefaults,
    isChanged,
    error,
    retry,
    rows,
    usedId,
    pickDefault,
    publishDefaults,
    resetDefaults,
  };
}
