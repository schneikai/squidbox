import type { PgTable } from 'drizzle-orm/pg-core';
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

// Server-side view of a syncable collection: its Drizzle table + the shared Zod schema, the fields a
// push may change (mergeFields), those of them merged by clock, and the write-once one (sync-design
// §7). Derived from the descriptor so it stays in lockstep with the contract.
export interface ServerCollection {
  name: string;
  table: PgTable;
  schema: z.ZodObject<z.ZodRawShape>;
  mergeFields: string[];
  clockedFields: string[];
  finalField?: string;
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const fields = mergeFields(descriptor);
  return {
    name: descriptor.name,
    table,
    schema: descriptor.schema as z.ZodObject<z.ZodRawShape>,
    mergeFields: fields,
    clockedFields: fields.filter((field) => field !== descriptor.finalField),
    finalField: descriptor.finalField,
  };
}

export const serverCollections: Record<string, ServerCollection> = {
  assets: serverCollection(assets, assetCollection),
  albums: serverCollection(albums, albumCollection),
  posts: serverCollection(posts, postCollection),
  album_assets: serverCollection(albumAssets, albumAssetCollection),
  post_assets: serverCollection(postAssets, postAssetCollection),
};

// Strip server-only columns (user_id, server_seq, field_clock, an asset's files_deleted_at) to
// produce the client-facing record.
export function toWireRecord(row: Record<string, unknown>): Record<string, unknown> {
  const {
    userId: _userId,
    serverSeq: _serverSeq,
    fieldClock: _fieldClock,
    filesDeletedAt: _filesDeletedAt,
    ...rest
  } = row;
  return rest;
}
