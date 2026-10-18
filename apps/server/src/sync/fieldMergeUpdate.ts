import { sql, type SQL } from 'drizzle-orm';
import { assets } from '../db/schema.js';
import type { ServerCollection } from './collections.js';
import { storedClocks } from './storedClocks.js';

/**
 * The DO UPDATE of a per-field push (sync-design §6, §7): each sent field applies when its clock is
 * newer than the stored one (strict >, so a replay changes nothing), the others keep their value and
 * clock, and `updated_at` is the newest clock. The row is updated, and gets a new server_seq, only
 * when a field applies. For assets, a purged row is final and a purge applies only when the merged
 * row is deleted. `sent` holds merge fields only: they are written into the SQL as names.
 */
export function fieldMergeUpdate(col: ServerCollection, sent: string[]): { set: Record<string, SQL>; setWhere: SQL } {
  const table = col.table as any;
  const name = (field: string) => sql.raw(`'${field}'`);
  const sentClock = (field: string) => sql`(excluded.field_clock->>${name(field)})::bigint`;
  const storedClock = (field: string) =>
    sql`coalesce((${table.fieldClock}->>${name(field)})::bigint, case when ${table.fieldClock} is null then ${table.updatedAt} else 0 end)`;
  const wins = (field: string) => sql`(${sentClock(field)} > ${storedClock(field)})`;
  const sentValue = (field: string) => sql`excluded.${sql.identifier(table[field].name)}`;
  const mergedDeletedAt = sent.includes('deletedAt')
    ? sql`(case when ${wins('deletedAt')} then ${sentValue('deletedAt')} else ${table.deletedAt} end)`
    : sql`${table.deletedAt}`;
  const applies = (field: string) =>
    col.table === assets && field === 'purgedAt'
      ? sql`(${wins(field)} and ${mergedDeletedAt} is not null)`
      : wins(field);

  const set: Record<string, SQL> = {};
  for (const field of sent)
    set[field] = sql`case when ${applies(field)} then ${sentValue(field)} else ${table[field]} end`;
  const appliedClocks = sent.map(
    (field) => sql`${name(field)}, case when ${applies(field)} then excluded.field_clock->${name(field)} end`,
  );
  set.fieldClock = sql`${storedClocks(col)} || jsonb_strip_nulls(jsonb_build_object(${sql.join(appliedClocks, sql`, `)}))`;
  const newerClocks = sent.map((field) => sql`, case when ${applies(field)} then ${sentClock(field)} end`);
  set.updatedAt = sql`greatest(${table.updatedAt}${sql.join(newerClocks)})`;

  const anyApplies = sent.length > 0 ? sql`(${sql.join(sent.map(applies), sql` or `)})` : sql`false`;
  const setWhere = col.table === assets ? sql`${assets.purgedAt} is null and ${anyApplies}` : anyApplies;
  return { set, setWhere };
}
