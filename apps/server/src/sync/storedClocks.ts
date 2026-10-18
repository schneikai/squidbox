import { sql, type SQL } from 'drizzle-orm';
import type { ServerCollection } from './collections.js';

// The row's field clocks, as stored: a row last written before per-field merge has none, so each of
// its merge fields takes the row's updated_at (sync-design §7). Field names come from the schema.
export function storedClocks(col: ServerCollection): SQL {
  const table = col.table as any;
  const pairs = col.mergeFields.map((field) => sql`${sql.raw(`'${field}'`)}, ${table.updatedAt}`);
  return sql`coalesce(${table.fieldClock}, jsonb_build_object(${sql.join(pairs, sql`, `)}))`;
}
