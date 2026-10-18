import type { OutboxRow } from './db/schema';

/**
 * The sync log's note for a push that lost to the server (sync-design §13): the pushed fields whose
 * value the server's `current` replaced, e.g. `albums <id>: name overwritten by server`.
 */
export function overwrittenNote(
  collection: string,
  id: string,
  pushed: OutboxRow | undefined,
  current: Record<string, unknown>,
): string {
  const lost = Object.keys(pushed?.fields ?? {}).filter(
    (field) => field in current && !Object.is(current[field], pushed!.payload[field]),
  );
  return `${collection} ${id}: ${lost.length > 0 ? lost.join(', ') : 'local change'} overwritten by server`;
}
