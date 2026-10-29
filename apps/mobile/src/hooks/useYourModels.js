import { modelPickIds, resolveModelDefaults } from '@squidbox/shared';
import { useCallback, useEffect, useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import usePersona from '@/hooks/usePersona';
import useYourDefaults from '@/hooks/useYourDefaults';
import applyAiCatalog from '@/lib/applyAiCatalog';
import useLibrary from '@/library/useLibrary';
import { addYourModel, readModelList, seedYourModels } from '@/sync/aiStateRepository';
import { getDb, schema } from '@/sync/db/client';
import { clearPicks, clearPicksEqualTo, pickDefault as savePick, readModelPicks } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';
import { requestSync } from '@/sync/worker';
import findCatalogModel from '@/utils/ai/findCatalogModel';
import joinYourModels from '@/utils/ai/joinYourModels';
import modelsOfKind from '@/utils/ai/modelsOfKind';
import seedModels from '@/utils/ai/seedModels';
import fetchAiModelsAsync from '@/utils/cloud-api/ai/fetchAiModelsAsync';
import setModelDefaultsAsync from '@/utils/cloud-api/ai/setModelDefaultsAsync';

/**
 * Your models of a kind (an ai_admin tool), live: `rows` your list joined with Venice's models
 * (useAiCatalog's `catalog`, `error` and `retry`; `defaults` what everyone uses), null until both
 * are in; `yourDefaults` the defaults this account uses, your picks over `defaults`, by kind and
 * variant like `defaults` (null while either loads), and `isChanged` whether they differ from
 * `defaults` for this kind (useYourDefaults'); `usedId` the one the assistant uses now, the default
 * for the persona's Adult content switch (null while loading). `pickDefault(variant, model)` picks
 * your Default (`regular`) or Uncensored default (`unrestricted`) of the kind, null to follow the
 * published one; `readDefaultsToApply()` reads what Apply changes for everyone would make
 * everyone's, for its confirm; `publishDefaults()` is Apply changes for everyone: your picks of the
 * kind become everyone's (a variant without one keeps its published default), and the picks now
 * equal to them are cleared (one changed during the request stays); `resetDefaults()` clears both
 * picks of the kind, back to the published defaults. The picks sync with the account, the list
 * stays on the device. On the first run the list starts with the verified models Venice still has,
 * and the defaults this account uses are always in it.
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

  // A default this account uses stays in the list: one removed while it was only the published
  // default comes back once it is yours again (Reset changes, a pick on another device).
  useEffect(() => {
    if (!catalog || !list || !yourDefaults) return;
    const listed = new Set(list.map(({ id }) => id));
    for (const id of new Set(Object.values(yourDefaults[kind]))) {
      if (listed.has(id)) continue;
      addYourModel(getDb(), kind, { id, name: findCatalogModel(catalog, id)?.name ?? id }).catch((error) =>
        console.error('Adding a default to your models failed', error),
      );
    }
  }, [catalog, list, yourDefaults, kind]);

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

  // Your picks over the published defaults the server has now (another admin may have changed
  // them), with the fresh catalog's models to name them; the catalog goes in front of every screen.
  async function readDefaultsToApply() {
    const [answer, picks] = await Promise.all([fetchAiModelsAsync(), readModelPicks(getDb(), userId)]);
    applyAiCatalog(answer);
    return { models: answer.models, ids: resolveModelDefaults(kind, picks, answer.defaults) };
  }

  // The server keeps the published default of a variant without a pick, so one another admin
  // published meanwhile stays. A failing local clean-up after a done publish is only logged.
  async function publishDefaults() {
    const picks = await readModelPicks(getDb(), userId);
    const answer = await setModelDefaultsAsync(kind, modelPickIds(kind, picks));
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
    readDefaultsToApply,
    publishDefaults,
    resetDefaults,
  };
}
