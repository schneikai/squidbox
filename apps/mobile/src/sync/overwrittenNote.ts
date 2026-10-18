import { lostFields, type FieldClocks } from '@squidbox/shared';

/**
 * The sync log's note for a push that lost to the server (sync-design §13): the pushed fields whose
 * value the server's `current` replaced, e.g. `albums <id>: name overwritten by server`.
 */
export function overwrittenNote(
  collection: string,
  id: string,
  fields: FieldClocks,
  payload: Record<string, unknown>,
  current: Record<string, unknown>,
): string {
  const lost = lostFields(Object.keys(fields), payload, current);
  return `${collection} ${id}: ${lost.length > 0 ? lost.join(', ') : 'local change'} overwritten by server`;
}
