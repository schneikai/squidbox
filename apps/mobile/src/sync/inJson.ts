import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';

/** `column` is one of `values`, passed as one JSON parameter (no limit on the number of SQL variables). */
export function inJson(column: SQLWrapper, values: unknown[]): SQL {
  return sql`${column} in (select value from json_each(${JSON.stringify(values)}))`;
}
