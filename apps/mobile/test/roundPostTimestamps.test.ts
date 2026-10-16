import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { makePostRecord } from './helpers/factory';
import journal from '../src/sync/db/migrations/meta/_journal.json';

const migrationsFolder = fileURLToPath(new URL('../src/sync/db/migrations', import.meta.url));
const migrations = readMigrationFiles({ migrationsFolder });
const index = journal.entries.findIndex((entry) => entry.tag === '0008_round_post_timestamps');

function migrate(sqlite: Database.Database, from: number, to: number) {
  for (const migration of migrations.slice(from, to)) {
    for (const statement of migration.sql) sqlite.exec(statement);
  }
}

describe('migration 0008_round_post_timestamps', () => {
  it('rounds fractional post timestamps and the post payloads waiting in the outbox', () => {
    const sqlite = new Database(':memory:');
    migrate(sqlite, 0, index);

    const postponed = makePostRecord({ updatedAt: 2000, suggestRepostAt: 1734567890123.5 });
    const posted = makePostRecord({ updatedAt: 3000.25, postedAt: 2500.75, suggestRepostAt: 2500 });
    const untouched = makePostRecord({ updatedAt: 4000, suggestRepostAt: 4000 });
    const insertPost = sqlite.prepare(
      `INSERT INTO posts (id, created_at, updated_at, deleted_at, text, is_favorite, posted_at, re_post_id,
        is_ignored_for_repost, suggest_repost_at, has_been_reposted)
       VALUES (@id, @createdAt, @updatedAt, @deletedAt, @text, 0, @postedAt, @rePostId, 0, @suggestRepostAt, 0)`,
    );
    const insertOutbox = sqlite.prepare(
      `INSERT INTO outbox (collection, record_id, op, payload, updated_at) VALUES (?, ?, 'upsert', ?, ?)`,
    );
    for (const post of [postponed, posted, untouched]) {
      insertPost.run(post);
      insertOutbox.run('posts', post.id, JSON.stringify(post), post.updatedAt);
    }

    migrate(sqlite, index, index + 1);

    const rows = sqlite
      .prepare(
        'SELECT id, updated_at AS updatedAt, posted_at AS postedAt, suggest_repost_at AS suggestRepostAt FROM posts',
      )
      .all();
    expect(rows).toEqual([
      { id: postponed.id, updatedAt: 2000, postedAt: null, suggestRepostAt: 1734567890124 },
      { id: posted.id, updatedAt: 3000, postedAt: 2501, suggestRepostAt: 2500 },
      { id: untouched.id, updatedAt: 4000, postedAt: null, suggestRepostAt: 4000 },
    ]);
    const outbox = (sqlite.prepare('SELECT payload, updated_at AS updatedAt FROM outbox').all() as any[]).map(
      (row) => ({ ...JSON.parse(row.payload), outboxUpdatedAt: row.updatedAt }),
    );
    expect(outbox).toEqual([
      { ...postponed, suggestRepostAt: 1734567890124, outboxUpdatedAt: 2000 },
      { ...posted, updatedAt: 3000, postedAt: 2501, outboxUpdatedAt: 3000 },
      { ...untouched, outboxUpdatedAt: 4000 },
    ]);
  });
});
