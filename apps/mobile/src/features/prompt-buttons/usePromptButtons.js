import { useEffect, useMemo } from 'react';

import defaultPromptButtons from './defaultPromptButtons';
import { PLACEMENTS } from './placementText';

import { getDb, schema } from '@/sync/db/client';
import { readPromptButtons, seedPromptButtons } from '@/sync/promptButtonsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The prompt buttons, live, grouped by placement in their order (`{ post: [...], newPost: [...],
 * refine: [...] }`, undefined while reading). Seeds the default set the first time, once per
 * library (seedPromptButtons).
 */
export default function usePromptButtons() {
  // sync_meta too: the seed waits for the first full pull.
  const rows = useLiveQuery((db) => readPromptButtons(db), [schema.promptButtons, schema.syncMeta]);

  useEffect(() => {
    if (rows === undefined || rows.length > 0) return;
    seedPromptButtons(getDb(), defaultPromptButtons).catch((error) =>
      console.error('Seeding the prompt buttons failed', error),
    );
  }, [rows]);

  return useMemo(
    () =>
      rows &&
      Object.fromEntries(PLACEMENTS.map((placement) => [placement, rows.filter((row) => row.placement === placement)])),
    [rows],
  );
}
