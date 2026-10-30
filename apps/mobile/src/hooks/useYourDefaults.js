import { aiModelKindSchema, MODEL_DEFAULT_VARIANTS, resolveModelDefaults } from '@squidbox/shared';
import { useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readModelPicks } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The defaults this account uses, live (an ai_admin tool): `yourDefaults`, its picks over the
 * published `defaults` (useAiCatalog's), by kind and variant like `defaults`, null while either
 * loads; `changedKinds`, the kinds whose picks differ from the published defaults (null while
 * loading).
 */
export default function useYourDefaults() {
  const { defaults } = useAiCatalog();
  const { library } = useLibrary();
  const userId = library.owner.userId;
  const picks = useLiveQuery((db) => readModelPicks(db, userId), [schema.modelChoices], [userId]);

  return useMemo(() => {
    if (picks === undefined || !defaults) return { defaults, yourDefaults: null, changedKinds: null };
    const yourDefaults = Object.fromEntries(
      aiModelKindSchema.options.map((kind) => [kind, resolveModelDefaults(kind, picks, defaults)]),
    );
    const changedKinds = aiModelKindSchema.options.filter((kind) =>
      MODEL_DEFAULT_VARIANTS.some((variant) => yourDefaults[kind][variant] !== defaults[kind][variant]),
    );
    return { defaults, yourDefaults, changedKinds };
  }, [picks, defaults]);
}
