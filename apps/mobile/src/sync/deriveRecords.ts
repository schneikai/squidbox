/* eslint-disable @typescript-eslint/no-explicit-any -- works on any record shape */

type Extras = Record<string, unknown>;

export interface DerivedRecords {
  records: Record<string, any>;
  cache: Map<unknown, { row: any; extras: Extras; record: any }>;
  extrasOf: (row: any) => Extras;
}

/**
 * Id-keyed `{ ...row, ...extrasOf(row) }` records that keep their objects while nothing they're
 * made of changed, so memoized cells and selectors skip them. Live rows keep their objects when
 * unchanged (see readLiveRows), so a write to one of 50,000 rows rebuilds one record; with the
 * same `extrasOf`, the result is `previous` itself when no row changed.
 */
export function deriveRecords(rows: any[], extrasOf: (row: any) => Extras, previous?: DerivedRecords): DerivedRecords {
  if (previous?.extrasOf === extrasOf) return updateChangedRows(rows, previous);

  const records: Record<string, any> = {};
  const cache: DerivedRecords['cache'] = new Map();
  for (const row of rows) {
    const extras = extrasOf(row);
    const before = previous?.cache.get(row.id);
    const isSame = before && before.row === row && haveSameValues(before.extras, extras);
    const record = isSame ? before.record : { ...row, ...extras };
    records[row.id] = record;
    cache.set(row.id, { row, extras, record });
  }
  return { records, cache, extrasOf };
}

// The derived inputs are unchanged, so only rows that are new objects need a new record.
function updateChangedRows(rows: any[], previous: DerivedRecords): DerivedRecords {
  const changed = rows.filter((row) => previous.cache.get(row.id)?.row !== row);
  if (changed.length === 0 && rows.length === previous.cache.size) return previous;

  const records = { ...previous.records };
  const cache = new Map(previous.cache);
  for (const row of changed) {
    const extras = previous.extrasOf(row);
    const record = { ...row, ...extras };
    records[row.id] = record;
    cache.set(row.id, { row, extras, record });
  }
  if (cache.size > rows.length) {
    const present = new Set(rows.map((row) => row.id));
    for (const id of cache.keys()) {
      if (present.has(id)) continue;
      cache.delete(id);
      delete records[id as string];
    }
  }
  return { records, cache, extrasOf: previous.extrasOf };
}

function haveSameValues(a: Extras, b: Extras): boolean {
  return Object.keys(b).every((key) => a[key] === b[key]);
}
