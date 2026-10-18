import { describe, it, expect } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { serverCollections } from '../src/sync/collections.js';
import { fieldMergeUpdate } from '../src/sync/fieldMergeUpdate.js';

const dialect = new PgDialect();
const render = (query: SQL) => dialect.sqlToQuery(query).sql;

const stored = (table: string, field: string) =>
  `coalesce(("${table}"."field_clock"->>'${field}')::bigint, case when "${table}"."field_clock" is null then "${table}"."updated_at" else 0 end)`;
const wins = (table: string, field: string) => `((excluded.field_clock->>'${field}')::bigint > ${stored(table, field)})`;

describe('fieldMergeUpdate', () => {
  it('applies each sent field whose clock is newer than the stored one, and updates only then', () => {
    const { set, setWhere } = fieldMergeUpdate(serverCollections.albums, ['name', 'isFavorite']);
    expect(render(setWhere)).toBe(`(${wins('albums', 'name')} or ${wins('albums', 'isFavorite')})`);
    expect(render(set.name)).toBe(`case when ${wins('albums', 'name')} then excluded."name" else "albums"."name" end`);
    expect(Object.keys(set).sort()).toEqual(['fieldClock', 'isFavorite', 'name', 'updatedAt']);
    expect(render(set.updatedAt)).toBe(
      `greatest("albums"."updated_at", case when ${wins('albums', 'name')} then (excluded.field_clock->>'name')::bigint end` +
        `, case when ${wins('albums', 'isFavorite')} then (excluded.field_clock->>'isFavorite')::bigint end)`,
    );
  });

  it('keeps the clocks of the fields that don’t apply, a row without clocks taking its updated_at for each', () => {
    const { set } = fieldMergeUpdate(serverCollections.album_assets, ['position']);
    const fieldClock = render(set.fieldClock);
    expect(fieldClock).toMatch(
      /^coalesce\("album_assets"\."field_clock", jsonb_build_object\('deletedAt', "album_assets"\."updated_at", .*'position', "album_assets"\."updated_at"\)\) \|\| jsonb_strip_nulls\(/,
    );
    expect(fieldClock).toContain(`jsonb_build_object('position', case when ${wins('album_assets', 'position')} then excluded.field_clock->'position' end))`);
  });

  it('never updates a purged asset, and purges only an asset that stays deleted', () => {
    const purgeOnly = fieldMergeUpdate(serverCollections.assets, ['purgedAt']);
    expect(render(purgeOnly.setWhere)).toBe(
      `"assets"."purged_at" is null and ((${wins('assets', 'purgedAt')} and "assets"."deleted_at" is not null))`,
    );
    const withDelete = fieldMergeUpdate(serverCollections.assets, ['deletedAt', 'purgedAt']);
    expect(render(withDelete.set.purgedAt)).toContain(
      `(case when ${wins('assets', 'deletedAt')} then excluded."deleted_at" else "assets"."deleted_at" end) is not null`,
    );
  });

  it('names fields as literals, with no parameters, and updates nothing when no field is sent', () => {
    const { set, setWhere } = fieldMergeUpdate(serverCollections.posts, []);
    expect(render(setWhere)).toBe('false');
    for (const part of [...Object.values(set), setWhere]) expect(dialect.sqlToQuery(part).params).toEqual([]);
  });
});
