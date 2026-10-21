import { sql, type SQL } from 'drizzle-orm';
import type { ServerCollection } from './collections.js';

// A field name as a JSON key literal. Field names come from the collection schemas, never the client.
const jsonKey = (field: string) => sql.raw(`'${field}'`);

/**
 * The DO UPDATE of a push (sync-design §6, §7): each sent field applies when its clock is newer than
 * the stored one (strict >, so a replay changes nothing), the others keep their value and clock, and
 * `updated_at` is the newest clock. A field without a stored clock takes the row's updated_at. The
 * deletion group follows its own rule (below) and a row with the final field is frozen. The row is
 * updated, and gets a new server_seq, only when a field applies. `sent` holds merge fields only, in
 * schema order: they are written into the SQL as names.
 */
export function fieldMergeUpdate(col: ServerCollection, sent: string[]): { set: Record<string, SQL>; setWhere: SQL } {
  const table = col.table as any;
  const clocked = sent.filter((field) => col.clockedFields.includes(field));
  const sentClock = (field: string) => sql`(excluded.field_clock->>${jsonKey(field)})::bigint`;
  const sentValue = (field: string) => sql`excluded.${sql.identifier(table[field].name)}`;
  const storedClock = (field: string) =>
    sql`coalesce((${table.fieldClock}->>${jsonKey(field)})::bigint, ${table.updatedAt})`;
  const wins = (field: string) => sql`(${sentClock(field)} > ${storedClock(field)})`;
  // The deletion group (deletedAt with the final field, a purge): a purge loses, with its deletedAt,
  // to a restore it hadn't seen, i.e. a row live again since after the deletion the purge was made of,
  // whatever its clock; the photo is kept. Otherwise deletedAt merges by clock, and the purge applies
  // to a row deleted once merged. A purged row is frozen (setWhere).
  const final = col.finalField && sent.includes(col.finalField) ? col.finalField : undefined;
  const restoredSince = final
    ? sql`(${sentValue(final)} is not null and ${table.deletedAt} is null and coalesce(${storedClock('deletedAt')} > ${sentValue('deletedAt')}, true))`
    : sql`false`;
  const appliesDeletedAt = final ? sql`(${wins('deletedAt')} and not ${restoredSince})` : wins('deletedAt');
  const mergedDeletedAt = clocked.includes('deletedAt')
    ? sql`(case when ${appliesDeletedAt} then ${sentValue('deletedAt')} else ${table.deletedAt} end)`
    : sql`${table.deletedAt}`;
  // Write-once: set on a record that is deleted once this push merged, never changed after.
  const appliesFinal = (field: string) =>
    sql`(${sentValue(field)} is not null and ${table[field]} is null and ${mergedDeletedAt} is not null)`;
  const appliesTo = (field: string) =>
    field === col.finalField ? appliesFinal(field) : field === 'deletedAt' ? appliesDeletedAt : wins(field);
  const applies = new Map(sent.map((field) => [field, appliesTo(field)]));

  const set: Record<string, SQL> = {};
  for (const field of sent)
    set[field] = sql`case when ${applies.get(field)} then ${sentValue(field)} else ${table[field]} end`;
  // Every clocked field present, one without a stored clock at updated_at, pinned before updated_at moves.
  const storedClocks = sql`jsonb_build_object(${sql.join(
    col.clockedFields.map((field) => sql`${jsonKey(field)}, ${table.updatedAt}`),
    sql`, `,
  )}) || coalesce(${table.fieldClock}, '{}'::jsonb)`;
  const appliedClocks = clocked.map(
    (field) => sql`${jsonKey(field)}, case when ${applies.get(field)} then excluded.field_clock->${jsonKey(field)} end`,
  );
  set.fieldClock = sql`${storedClocks} || jsonb_strip_nulls(jsonb_build_object(${sql.join(appliedClocks, sql`, `)}))`;
  const newerClocks = clocked.map((field) => sql`, case when ${applies.get(field)} then ${sentClock(field)} end`);
  set.updatedAt = sql`greatest(${table.updatedAt}${sql.join(newerClocks)})`;

  const anyApplies = sent.length > 0 ? sql`(${sql.join([...applies.values()], sql` or `)})` : sql`false`;
  const setWhere = col.finalField ? sql`${table[col.finalField]} is null and ${anyApplies}` : anyApplies;
  return { set, setWhere };
}
