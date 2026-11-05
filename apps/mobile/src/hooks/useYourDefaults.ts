import {
  type AiModelKind,
  aiModelKindSchema,
  MODEL_DEFAULT_VARIANTS,
  type ModelDefaults,
  resolveModelDefaults,
} from '@squidbox/shared';
import { useMemo } from 'react';

import useAiCatalog from '@/hooks/useAiCatalog';
import useOpenLibrary from '@/library/useOpenLibrary';
import { schema } from '@/sync/db/client';
import { readModelPicks } from '@/sync/modelChoicesRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

export type YourDefaults = {
  defaults: ModelDefaults | null;
  yourDefaults: ModelDefaults | null;
  changedKinds: AiModelKind[] | null;
};

/**
 * The defaults this account uses, live (an ai_admin tool): `yourDefaults`, its picks over the
 * published `defaults` (useAiCatalog's), by kind and variant like `defaults`, null while either
 * loads; `changedKinds`, the kinds whose picks differ from the published defaults (null while
 * loading).
 */
export default function useYourDefaults(): YourDefaults {
  const { defaults } = useAiCatalog();
  const { userId } = useOpenLibrary();
  // None in this device's library, which has no account: the defaults stay loading there.
  const picks = useLiveQuery(
    async (db) => (userId === null ? null : readModelPicks(db, userId)),
    [schema.modelChoices],
    [userId],
  );

  return useMemo(() => {
    if (!picks || !defaults) return { defaults, yourDefaults: null, changedKinds: null };
    const yourDefaults = Object.fromEntries(
      aiModelKindSchema.options.map((kind) => [kind, resolveModelDefaults(kind, picks, defaults)]),
    ) as ModelDefaults;
    const changedKinds = aiModelKindSchema.options.filter((kind) =>
      MODEL_DEFAULT_VARIANTS.some((variant) => yourDefaults[kind][variant] !== defaults[kind][variant]),
    );
    return { defaults, yourDefaults, changedKinds };
  }, [picks, defaults]);
}
