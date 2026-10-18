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

// Server-side view of a syncable collection: its Drizzle table + the shared Zod schema, plus
// the set of columns to update on an LWW upsert (all synced fields except the PK `id` and the
// immutable `createdAt`) and the fields that merge one by one (those but `updatedAt`). Derived
// from the descriptor so it stays in lockstep with the contract.
export interface ServerCollection {
  name: string;
  table: PgTable;
  schema: z.ZodObject<z.ZodRawShape>;
  updateColumns: string[];
  mergeFields: string[];
}

function updatableColumns(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape).filter((k) => k !== 'id' && k !== 'createdAt');
}

function serverCollection(table: PgTable, descriptor: CollectionDescriptor): ServerCollection {
  const schema = descriptor.schema as z.ZodObject<z.ZodRawShape>;
  return {
    name: descriptor.name,
    table,
    schema,
    updateColumns: updatableColumns(schema),
    mergeFields: mergeFields(descriptor),
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
