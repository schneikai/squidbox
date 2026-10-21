import { getTableColumns, getTableName, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import {
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
  clockedFields,
  mergeFields,
  type CollectionDescriptor,
} from '@squidbox/shared';
import { assets, albums, posts, albumAssets, postAssets } from '../db/schema.js';

// Server-side view of a syncable collection: its Drizzle table, its shared descriptor (with its Zod
// schema as an object), the columns of the client-facing record (the schema's fields; user_id,
// server_seq, field_clock, restored_through and an asset's files_deleted_at stay on the server), the
// fields a push may change (mergeFields) and those of them merged by clock (clockedFields, §7), and
// the push's upsert: what it sets on a conflict, and the guard that keeps it from un-purging a row or
// setting updated_at back.
export interface ServerCollection {
  table: PgTable;
  descriptor: CollectionDescriptor;
  schema: z.ZodObject<z.ZodRawShape>;
  wireColumns: Record<string, PgColumn>;
  mergeFields: string[];
  clockedFields: string[];
  /** A collection with a final field keeps the largest deletedAt a restore undid (sync-design §7). */
  restoredThrough: PgColumn | undefined;
  upsertSet: Record<string, SQL>;
  upsertGuard: SQL;
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const schema = descriptor.schema as z.ZodObject<z.ZodRawShape>;
  const columns = getTableColumns(table);
  const wireColumns = Object.fromEntries(Object.entries(columns).filter(([key]) => key in schema.shape));
  const restoredThrough = descriptor.finalField ? columns.restoredThrough : undefined;
  const written = { ...wireColumns, fieldClock: columns.fieldClock!, ...(restoredThrough && { restoredThrough }) };
  const stored = (key: string) => sql`${sql.identifier(getTableName(table))}.${sql.identifier(columns[key]!.name)}`;
  const sent = (key: string) => sql`excluded.${sql.identifier(columns[key]!.name)}`;
  const notSetBack = sql`${stored('updatedAt')} <= ${sent('updatedAt')}`;
  return {
    table,
    descriptor,
    schema,
    wireColumns,
    mergeFields: mergeFields(descriptor),
    clockedFields: clockedFields(descriptor),
    restoredThrough,
    upsertSet: Object.fromEntries(
      Object.entries(written)
        .filter(([key]) => key !== 'id')
        .map(([key]) => [key, sent(key)]),
    ),
    upsertGuard: descriptor.finalField ? sql`${stored(descriptor.finalField)} is null and ${notSetBack}` : notSetBack,
  };
}

export const serverCollections: Record<string, ServerCollection> = {
  assets: serverCollection(assets, assetCollection),
  albums: serverCollection(albums, albumCollection),
  posts: serverCollection(posts, postCollection),
  album_assets: serverCollection(albumAssets, albumAssetCollection),
  post_assets: serverCollection(postAssets, postAssetCollection),
};
