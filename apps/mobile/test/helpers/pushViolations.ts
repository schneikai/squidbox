import type { FieldClocks, PushMutation, PushResult } from '@squidbox/shared';
import { expect } from 'vitest';

import { serverCollections } from '../../../server/src/sync/collections.js';
import { sentFields } from '../../../server/src/sync/sentFields.js';

/** The server's rows of `collection` with these ids, by id, as the wire carries them. */
type ServerRows = (collection: string, ids: string[]) => Promise<Map<string, Record<string, any>>>;

/**
 * The invariants one push's results must keep (sync-design §6), checked against the server's rows
 * after the push: `applied` means every field it merged holds the pushed value (and its purge, when
 * the row holds one); `skipped-lww` means something it merged was lost, or a whole record (no
 * fields) ended older than the row, and carries the server row as `current`. Returns what breaks them.
 */
export async function pushViolations(
  mutations: PushMutation[],
  results: PushResult[],
  serverRows: ServerRows,
): Promise<string[]> {
  const violations: string[] = [];
  const rows = new Map<string, Map<string, Record<string, any>>>();
  for (const collection of new Set(mutations.map((mutation) => mutation.collection)))
    rows.set(
      collection,
      await serverRows(
        collection,
        results.filter((_, i) => mutations[i]!.collection === collection).map((result) => result.id),
      ),
    );
  for (const [i, result] of results.entries()) {
    const mutation = mutations[i]!;
    const col = serverCollections[mutation.collection]!;
    const record = mutation.record as Record<string, unknown>;
    const merged = Object.keys(
      sentFields(col, record as never, mutation.fields as FieldClocks | undefined, Number.MAX_SAFE_INTEGER),
    );
    const row = rows.get(mutation.collection)!.get(result.id);
    const lost = merged.filter((field) => !Object.is(row?.[field], record[field]));
    const final = col.descriptor.finalField;
    const purgeMissing = !!final && row?.[final] != null && !Object.is(row[final], record[final] ?? null);
    const where = `${mutation.collection} ${result.id}`;
    if (result.status === 'applied' && (lost.length > 0 || purgeMissing))
      violations.push(
        `${where}: applied, but ${[lost.length > 0 && `lost ${lost}`, purgeMissing && 'its row holds another purge'].filter(Boolean).join(' and ')}`,
      );
    if (result.status === 'skipped-lww') {
      // A whole record (no fields) is also told it lost when the row ends newer than it (§6).
      const stale = !mutation.fields && Number(row?.updatedAt) > Math.min(Number(record.updatedAt), Date.now());
      if (lost.length === 0 && !purgeMissing && !stale)
        violations.push(`${where}: skipped-lww, but every pushed field holds`);
      try {
        expect(result.current).toEqual(row);
      } catch {
        violations.push(`${where}: skipped-lww current is not the server row`);
      }
    }
  }
  return violations;
}
