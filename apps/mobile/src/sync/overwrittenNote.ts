import { collectionsByName, mergeFields } from '@squidbox/shared';

import type { OutboxRow } from './db/schema';

/**
 * The sync log's note for a push that lost to the server (sync-design §13): the pushed fields whose
 * value the server's `current` replaced, e.g. `albums <id>: name overwritten by server`.
 */
export function overwrittenNote(pushed: OutboxRow, current: Record<string, unknown>): string {
  const descriptor = collectionsByName[pushed.collection];
  const fields = pushed.fields ? Object.keys(pushed.fields) : descriptor ? mergeFields(descriptor) : [];
  const lost = fields.filter((field) => field in current && !Object.is(current[field], pushed.payload[field]));
  const what = lost.length > 0 ? lost.join(', ') : 'local change';
  return `${pushed.collection} ${pushed.recordId}: ${what} overwritten by server`;
}
