import { readMigrationFiles } from 'drizzle-orm/migrator';
import { describe, expect, it } from 'vitest';

import { migrationsFolder } from './helpers/testDb';

// A client migration runs over the rows an installed build wrote, and once shipped it can't be fixed
// (docs/sync-design.md §15): so a migration only adds, in the forms SQLite takes on a table with rows.
// installedBuilds.e2e runs the new ones over a row in every table; these catch what it can't reach (a
// table the installed builds don't have yet).
describe('client migrations', () => {
  const statements = readMigrationFiles({ migrationsFolder }).flatMap(({ sql }) => sql);

  it('add a NOT NULL column only with a default', () => {
    const refused = statements.filter((sql) =>
      /\bADD\s+(COLUMN\s+)?`?\w+`?\s[^;]*\bNOT\s+NULL\b/i.test(sql) ? !/\bDEFAULT\b/i.test(sql) : false,
    );
    expect(refused).toEqual([]);
  });

  it('never rebuild a table (drizzle-kit’s __new_ copy for a dropped, renamed or retyped column)', () => {
    expect(statements.filter((sql) => sql.includes('__new_'))).toEqual([]);
  });
});
