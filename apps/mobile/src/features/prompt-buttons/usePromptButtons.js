import { useMemo } from 'react';

import { PLACEMENTS } from './placementText';

import { schema } from '@/sync/db/client';
import { readPromptButtons } from '@/sync/promptButtonsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The prompt buttons, live, grouped by placement in their order (`{ post: [...], newPost: [...],
 * caption: [...], refine: [...] }`), undefined while reading.
 */
export default function usePromptButtons() {
  const rows = useLiveQuery((db) => readPromptButtons(db), [schema.promptButtons]);

  return useMemo(
    () =>
      rows &&
      Object.fromEntries(PLACEMENTS.map((placement) => [placement, rows.filter((row) => row.placement === placement)])),
    [rows],
  );
}
