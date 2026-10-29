import { resolveModelDefaults, resolveModelId } from '@squidbox/shared';
import { useMemo } from 'react';

import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readChosenModels } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * What this account uses, live: its picks over the published defaults (`defaults`, useAiCatalog's).
 * `picks` is this account's record of picks (an ai_admin's Default and Uncensored default of each
 * kind, null where none; undefined while reading); `yourDefaults` the defaults it uses, by kind and
 * variant like `defaults` (null while either loads); `usedId(kind)` the id it uses now, the default
 * for `persona`'s Adult content switch (usePersona's), null while any of them is still loading.
 */
export default function useChosenModels(persona, defaults) {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const picks = useLiveQuery((db) => readChosenModels(db, userId), [schema.modelChoices], [userId]);
  const yourDefaults = useMemo(
    () =>
      picks === undefined || !defaults
        ? null
        : {
            writing: resolveModelDefaults('writing', picks, defaults),
            vision: resolveModelDefaults('vision', picks, defaults),
          },
    [picks, defaults],
  );

  function usedId(kind) {
    if (picks === undefined || persona === undefined || !defaults) return null;
    return resolveModelId(kind, picks, persona?.adultContent, defaults);
  }

  return { picks, yourDefaults, usedId };
}
