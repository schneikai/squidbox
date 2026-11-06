import { schema } from '@/sync/db/client';
import { readPromptButtons } from '@/sync/promptButtonsRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The prompt buttons, live, in their order; undefined while reading. */
export default function usePromptButtons() {
  return useLiveQuery((db) => readPromptButtons(db), [schema.promptButtons]);
}
