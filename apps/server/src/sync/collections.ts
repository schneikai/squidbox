import { getTableColumns, getTableName, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import {
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
  type CollectionDescriptor,
} from '@squidbox/shared';
import { assets, albums, posts, albumAssets, postAssets } from '../db/schema.js';

// Server-side view of a syncable collection: its table and shared descriptor, the columns of the
// client-facing record (`wireColumns`; the server-only ones stay out), and the push's upsert.
export interface ServerCollection {
  table: PgTable;
  descriptor: CollectionDescriptor;
  schema: z.ZodObject<z.ZodRawShape>;
  wireColumns: Record<string, PgColumn>;
  /** A collection with a final field keeps the last deletedAt values a restore undid (sync-design §7). */
  restoredDeletions: PgColumn | undefined;
  /** The table's columns, which bound the rows per statement (Postgres takes 65,535 bind parameters). */
  columnCount: number;
  upsertSet: Record<string, SQL>;
  /** Never un-purge a row or set its updated_at back. */
  upsertGuard: SQL;
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const schema = descriptor.schema as z.ZodObject<z.ZodRawShape>;
  const columns = getTableColumns(table);
  const wireColumns = Object.fromEntries(Object.entries(columns).filter(([key]) => key in schema.shape));
  const restoredDeletions = descriptor.finalField ? columns.restoredDeletions : undefined;
  const written = { ...wireColumns, fieldClock: columns.fieldClock!, ...(restoredDeletions && { restoredDeletions }) };
  const stored = (key: string) => sql`${sql.identifier(getTableName(table))}.${sql.identifier(columns[key]!.name)}`;
  const sent = (key: string) => sql`excluded.${sql.identifier(columns[key]!.name)}`;
  const notSetBack = sql`${stored('updatedAt')} <= ${sent('updatedAt')}`;
  return {
    table,
    descriptor,
    schema,
    wireColumns,
    restoredDeletions,
    columnCount: Object.keys(columns).length,
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
