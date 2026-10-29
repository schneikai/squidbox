import { resolveModelId } from '@squidbox/shared';

import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readChosenModels } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The models the assistant uses, live: `chosen`, this account's choice of each kind (null for none;
 * undefined while reading), and `usedId(kind)`, the id it uses: the chosen one, or while there is
 * none the default for `persona`'s Adult content switch (usePersona's; `defaults` useAiCatalog's),
 * which stays unstored. null while any of them is still loading.
 */
export default function useChosenModels(persona, defaults) {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const chosen = useLiveQuery((db) => readChosenModels(db, userId), [schema.modelChoices], [userId]);

  function usedId(kind) {
    if (chosen === undefined || persona === undefined || !defaults) return null;
    return resolveModelId(kind, chosen[kind], persona?.adultContent, defaults);
  }

  return { chosen, usedId };
}
