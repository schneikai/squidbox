import { getTableColumns } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import {
  assetCollection,
  albumCollection,
  postCollection,
  albumAssetCollection,
  postAssetCollection,
  mergeFields,
  type CollectionDescriptor,
} from '@squidbox/shared';
import { assets, albums, posts, albumAssets, postAssets } from '../db/schema.js';

// Server-side view of a syncable collection: its Drizzle table + the shared Zod schema, the columns
// of the client-facing record (the schema's fields; user_id, server_seq, field_clock and an asset's
// files_deleted_at stay on the server), the fields a push may change (mergeFields), those of them
// merged by clock, the write-once one and the field groups (sync-design §7). Derived from the
// descriptor so it stays in lockstep with the contract.
export interface ServerCollection {
  name: string;
  table: PgTable;
  schema: z.ZodObject<z.ZodRawShape>;
  wireColumns: Record<string, PgColumn>;
  mergeFields: string[];
  clockedFields: string[];
  finalField?: string;
  fieldGroups: readonly (readonly string[])[];
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const fields = mergeFields(descriptor);
  const schema = descriptor.schema as z.ZodObject<z.ZodRawShape>;
  return {
    name: descriptor.name,
    table,
    schema,
    wireColumns: Object.fromEntries(Object.entries(getTableColumns(table)).filter(([key]) => key in schema.shape)),
    mergeFields: fields,
    clockedFields: fields.filter((field) => field !== descriptor.finalField),
    finalField: descriptor.finalField,
    fieldGroups: descriptor.fieldGroups,
  };
}

export const serverCollections: Record<string, ServerCollection> = {
  assets: serverCollection(assets, assetCollection),
  albums: serverCollection(albums, albumCollection),
  posts: serverCollection(posts, postCollection),
  album_assets: serverCollection(albumAssets, albumAssetCollection),
  post_assets: serverCollection(postAssets, postAssetCollection),
};
