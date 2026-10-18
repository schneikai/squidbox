import { sql, type SQL } from 'drizzle-orm';
import type { ServerCollection } from './collections.js';
import { jsonKey } from './jsonKey.js';

// The row's field clocks; a row without them takes its updated_at for each (sync-design §7).
export function storedClocks(col: ServerCollection): SQL {
  const table = col.table as any;
  const pairs = col.clockedFields.map((field) => sql`${jsonKey(field)}, ${table.updatedAt}`);
  return sql`coalesce(${table.fieldClock}, jsonb_build_object(${sql.join(pairs, sql`, `)}))`;
}
