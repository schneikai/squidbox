import { describe, it, expect } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { serverCollections } from '../src/sync/collections.js';
import { fieldMergeUpdate } from '../src/sync/fieldMergeUpdate.js';

const dialect = new PgDialect();
const render = (query: SQL) => dialect.sqlToQuery(query).sql;

const storedClocks = (table: string, fields: string[]) =>
  `coalesce("${table}"."field_clock", jsonb_build_object(${fields.map((f) => `'${f}', "${table}"."updated_at"`).join(', ')}))`;
const wins = (table: string, fields: string[], field: string) =>
  `((excluded.field_clock->>'${field}')::bigint > coalesce((${storedClocks(table, fields)}->>'${field}')::bigint, 0))`;

describe('fieldMergeUpdate', () => {
  const albumFields = serverCollections.albums.clockedFields;
  const albumWins = (field: string) => wins('albums', albumFields, field);

  it('applies each sent field whose clock is newer than the stored one, and updates only then', () => {
    const { set, setWhere } = fieldMergeUpdate(serverCollections.albums, ['name', 'isFavorite']);
    expect(render(setWhere)).toBe(`(${albumWins('name')} or ${albumWins('isFavorite')})`);
    expect(render(set.name)).toBe(`case when ${albumWins('name')} then excluded."name" else "albums"."name" end`);
    expect(Object.keys(set).sort()).toEqual(['fieldClock', 'isFavorite', 'name', 'updatedAt']);
    expect(render(set.updatedAt)).toBe(
      `greatest("albums"."updated_at", case when ${albumWins('name')} then (excluded.field_clock->>'name')::bigint end` +
        `, case when ${albumWins('isFavorite')} then (excluded.field_clock->>'isFavorite')::bigint end)`,
    );
  });

  it('keeps the clocks of the fields that don’t apply', () => {
    const fields = serverCollections.album_assets.clockedFields;
    const { set } = fieldMergeUpdate(serverCollections.album_assets, ['position']);
    expect(render(set.fieldClock)).toBe(
      `${storedClocks('album_assets', fields)} || jsonb_strip_nulls(jsonb_build_object('position', ` +
        `case when ${wins('album_assets', fields, 'position')} then excluded.field_clock->'position' end))`,
    );
  });

  it('never updates a purged asset, and purges once, only an asset that stays deleted, with no clock', () => {
    const fields = serverCollections.assets.clockedFields;
    expect(fields).not.toContain('purgedAt');
    const purge = fieldMergeUpdate(serverCollections.assets, ['deletedAt', 'purgedAt']);
    const mergedDeletedAt = `(case when ${wins('assets', fields, 'deletedAt')} then excluded."deleted_at" else "assets"."deleted_at" end)`;
    const appliesPurge = `(excluded."purged_at" is not null and "assets"."purged_at" is null and ${mergedDeletedAt} is not null)`;
    expect(render(purge.setWhere)).toBe(
      `"assets"."purged_at" is null and (${wins('assets', fields, 'deletedAt')} or ${appliesPurge})`,
    );
    expect(render(purge.set.fieldClock)).not.toContain(`'purgedAt'`);
  });

  it('names fields as literals, with no parameters, updates nothing when no field is sent, and builds once', () => {
    const { set, setWhere } = fieldMergeUpdate(serverCollections.posts, []);
    expect(render(setWhere)).toBe('false');
    for (const part of [...Object.values(set), setWhere]) expect(dialect.sqlToQuery(part).params).toEqual([]);
    expect(fieldMergeUpdate(serverCollections.posts, [])).toBe(fieldMergeUpdate(serverCollections.posts, []));
  });
});
