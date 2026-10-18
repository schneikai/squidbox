import { sql, type SQL } from 'drizzle-orm';

// A field name as a JSON key literal. Field names come from the collection schemas, never the client.
export function jsonKey(field: string): SQL {
  return sql.raw(`'${field}'`);
}
