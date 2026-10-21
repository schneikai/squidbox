import { widenToGroups, type FieldClocks } from '@squidbox/shared';
import type { ServerCollection } from './collections.js';

/**
 * The clocks a push merges (sync-design §6): its `fields`, or without them (older apps) every merge
 * field the record carries at its updatedAt. Keys that aren't merge fields the record carries are
 * dropped, so a stray key never blocks a row; a field group is widened to every member at the newest
 * sent clock of the group, so it never mixes two devices' values; future clocks are clamped to `now`.
 */
export function sentFields(
  col: ServerCollection,
  record: Record<string, unknown> & { updatedAt: number },
  fields: FieldClocks | undefined,
  now: number,
): FieldClocks {
  const carried = col.mergeFields.filter((field) => field in record);
  const clocks = widenToGroups(
    col.descriptor,
    fields
      ? Object.fromEntries(carried.filter((field) => field in fields).map((field) => [field, fields[field]!]))
      : Object.fromEntries(carried.map((field) => [field, record.updatedAt])),
  );
  return Object.fromEntries(
    carried.filter((field) => field in clocks).map((field) => [field, Math.min(clocks[field]!, now)]),
  );
}
