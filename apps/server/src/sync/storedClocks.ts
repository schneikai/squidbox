import { sql, type SQL } from 'drizzle-orm';
import type { ServerCollection } from './collections.js';
import { jsonKey } from './jsonKey.js';

// The row's field clocks, every clocked field present: one it has no clock for takes its updated_at
// (sync-design §7). Writing this back pins those clocks before updated_at moves.
export function storedClocks(col: ServerCollection): SQL {
  const table = col.table as any;
  const pairs = col.clockedFields.map((field) => sql`${jsonKey(field)}, ${table.updatedAt}`);
  return sql`jsonb_build_object(${sql.join(pairs, sql`, `)}) || coalesce(${table.fieldClock}, '{}'::jsonb)`;
}
