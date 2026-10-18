import { sql, type SQL } from 'drizzle-orm';
import type { ServerCollection } from './collections.js';
import { jsonKey } from './jsonKey.js';
import { storedClocks } from './storedClocks.js';

type MergeUpdate = { set: Record<string, SQL>; setWhere: SQL };

// Built once per collection and set of sent fields: the SQL has no parameters.
const built = new Map<string, MergeUpdate>();

/**
 * The DO UPDATE of a push (sync-design §6, §7): each sent field applies when its clock is newer than
 * the stored one (strict >, so a replay changes nothing), the others keep their value and clock, and
 * `updated_at` is the newest clock. The final field follows its own rule (appliesFinal) and a row
 * that has it is frozen. The row is updated, and gets a new server_seq, only when a field applies.
 * `sent` holds merge fields only, in schema order: they are written into the SQL as names.
 */
export function fieldMergeUpdate(col: ServerCollection, sent: string[]): MergeUpdate {
  const key = `${col.name}:${sent.join(',')}`;
  let update = built.get(key);
  if (!update) {
    update = buildMergeUpdate(col, sent);
    built.set(key, update);
  }
  return update;
}

function buildMergeUpdate(col: ServerCollection, sent: string[]): MergeUpdate {
  const table = col.table as any;
  const clocked = sent.filter((field) => field !== col.finalField);
  const sentClock = (field: string) => sql`(excluded.field_clock->>${jsonKey(field)})::bigint`;
  const storedClock = (field: string) => sql`coalesce((${storedClocks(col)}->>${jsonKey(field)})::bigint, 0)`;
  const wins = (field: string) => sql`(${sentClock(field)} > ${storedClock(field)})`;
  const sentValue = (field: string) => sql`excluded.${sql.identifier(table[field].name)}`;
  const mergedDeletedAt = clocked.includes('deletedAt')
    ? sql`(case when ${wins('deletedAt')} then ${sentValue('deletedAt')} else ${table.deletedAt} end)`
    : sql`${table.deletedAt}`;
  // Write-once: set on a record that is deleted once this push merged, never changed after.
  const appliesFinal = (field: string) =>
    sql`(${sentValue(field)} is not null and ${table[field]} is null and ${mergedDeletedAt} is not null)`;
  const applies = (field: string) => (field === col.finalField ? appliesFinal(field) : wins(field));

  const set: Record<string, SQL> = {};
  for (const field of sent)
    set[field] = sql`case when ${applies(field)} then ${sentValue(field)} else ${table[field]} end`;
  const appliedClocks = clocked.map(
    (field) => sql`${jsonKey(field)}, case when ${applies(field)} then excluded.field_clock->${jsonKey(field)} end`,
  );
  set.fieldClock = sql`${storedClocks(col)} || jsonb_strip_nulls(jsonb_build_object(${sql.join(appliedClocks, sql`, `)}))`;
  const newerClocks = clocked.map((field) => sql`, case when ${applies(field)} then ${sentClock(field)} end`);
  set.updatedAt = sql`greatest(${table.updatedAt}${sql.join(newerClocks)})`;

  const anyApplies = sent.length > 0 ? sql`(${sql.join(sent.map(applies), sql` or `)})` : sql`false`;
  const setWhere = col.finalField ? sql`${table[col.finalField]} is null and ${anyApplies}` : anyApplies;
  return { set, setWhere };
}
