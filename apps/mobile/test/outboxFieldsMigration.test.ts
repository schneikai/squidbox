import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import journal from '../src/sync/db/migrations/meta/_journal.json';

const migrationsFolder = fileURLToPath(new URL('../src/sync/db/migrations', import.meta.url));
const migrations = readMigrationFiles({ migrationsFolder });
const index = journal.entries.findIndex((entry) => entry.tag === '0011_outbox_fields');

function migrate(sqlite: Database.Database, from: number, to: number) {
  for (const migration of migrations.slice(from, to)) {
    for (const statement of migration.sql) sqlite.exec(statement);
  }
}

describe('migration 0011_outbox_fields', () => {
  it('names every field of a waiting payload at its updatedAt, so it merges like a whole record', () => {
    const sqlite = new Database(':memory:');
    migrate(sqlite, 0, index);
    const { notes: _notes, ...withoutNotes } = makeAssetRecord({ updatedAt: 2000 });
    sqlite
      .prepare(
        `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES ('assets', ?, 'upsert', ?, ?)`,
      )
      .run(withoutNotes.id, JSON.stringify(withoutNotes), 2000);

    migrate(sqlite, index, index + 1);

    const { fields } = sqlite.prepare('SELECT fields FROM outbox').get() as { fields: string };
    const expected = Object.keys(withoutNotes).filter((key) => !['id', 'createdAt', 'updatedAt'].includes(key));
    expect(JSON.parse(fields)).toEqual(Object.fromEntries(expected.map((key) => [key, 2000])));
  });
});
