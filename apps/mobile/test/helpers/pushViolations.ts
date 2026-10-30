import type { PushMutation, PushResult } from '@squidbox/shared';
import { expect } from 'vitest';

import { serverCollections } from '../../../server/src/sync/collections.js';
import { sentFields } from '../../../server/src/sync/sentFields.js';

type ServerRow = (collection: string, id: string) => Promise<Record<string, any> | undefined>;

/**
 * The invariants one push's results must keep (sync-design §6), checked against the server's rows
 * after the push: `applied` means every field it merged holds the pushed value (and its purge, when
 * the row holds one); `skipped-lww` means something it merged was lost, or a whole record (no
 * fields) ended older than the row, and carries the server row as `current`. Returns what breaks them.
 */
export async function pushViolations(
  mutations: PushMutation[],
  results: PushResult[],
  serverRow: ServerRow,
): Promise<string[]> {
  const violations: string[] = [];
  for (const [i, result] of results.entries()) {
    const mutation = mutations[i]!;
    const col = serverCollections[mutation.collection]!;
    const record = mutation.record as Record<string, unknown>;
    const merged = Object.keys(sentFields(col, record as never, mutation.fields, Number.MAX_SAFE_INTEGER));
    const row = await serverRow(mutation.collection, result.id);
    const lost = merged.filter((field) => !Object.is(row?.[field], record[field]));
    const final = col.descriptor.finalField;
    const purgeMissing = !!final && row?.[final] != null && !Object.is(row[final], record[final] ?? null);
    const where = `${mutation.collection} ${result.id}`;
    if (result.status === 'applied' && (lost.length > 0 || purgeMissing))
      violations.push(`${where}: applied, but lost ${lost}${purgeMissing ? ' (no purge)' : ''}`);
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
