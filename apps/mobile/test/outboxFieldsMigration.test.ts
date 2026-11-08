import { assetCollection } from '@squidbox/shared';
import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';

import { makeAssetRecord } from './helpers/factory';
import { migrationIndex, runMigrations } from './helpers/testDb';

const index = migrationIndex('0011_outbox_fields');
const migrate = (sqlite: Database.Database, from: number, to: number) => runMigrations(sqlite, { from, to });

describe('migration 0011_outbox_fields', () => {
  it('names every merge field of a waiting payload at its updatedAt, so it merges like a whole record', () => {
    const sqlite = new Database(':memory:');
    migrate(sqlite, 0, index);
    const { notes: _notes, ...rest } = makeAssetRecord({ updatedAt: 2000 });
    const withoutNotes = { ...rest, stray: 'not a field' };
    sqlite
      .prepare(
        `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES ('assets', ?, 'upsert', ?, ?)`,
      )
      .run(withoutNotes.id, JSON.stringify(withoutNotes), 2000);

    migrate(sqlite, index, index + 1);

    const { fields } = sqlite.prepare('SELECT fields FROM outbox').get() as { fields: string };
    const expected = assetCollection.mergeFields.filter((key) => key in withoutNotes);
    expect(expected).not.toContain('notes');
    expect(JSON.parse(fields)).toEqual(Object.fromEntries(expected.map((key) => [key, 2000])));
  });
});

describe('migration 0031_contacts', () => {
  it('gives an outbox row from before it an empty list of uploaded files', () => {
    const sqlite = new Database(':memory:');
    const contacts = migrationIndex('0031_contacts');
    migrate(sqlite, 0, contacts);
    const asset = makeAssetRecord();
    sqlite
      .prepare(
        `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES ('assets', ?, 'upsert', ?, 1)`,
      )
      .run(asset.id, JSON.stringify(asset));

    migrate(sqlite, contacts, contacts + 1);

    const { uploaded_files } = sqlite.prepare('SELECT uploaded_files FROM outbox').get() as { uploaded_files: string };
    expect(JSON.parse(uploaded_files)).toEqual([]);
  });
});
