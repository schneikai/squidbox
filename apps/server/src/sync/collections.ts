import type { PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { assetCollection } from '@squidbox/shared';
import { assets } from '../db/schema.js';

// Server-side view of a syncable collection: its Drizzle table + the shared Zod schema, plus
// the set of columns to update on an LWW upsert (all synced fields except the PK `id` and the
// immutable `createdAt`). Derived from the descriptor so it stays in lockstep with the contract.
export interface ServerCollection {
  name: string;
  table: PgTable;
  schema: z.ZodObject<z.ZodRawShape>;
  updateColumns: string[];
}

function updatableColumns(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape).filter((k) => k !== 'id' && k !== 'createdAt');
}

export const serverCollections: Record<string, ServerCollection> = {
  assets: {
    name: 'assets',
    table: assets,
    schema: assetCollection.schema as z.ZodObject<z.ZodRawShape>,
    updateColumns: updatableColumns(assetCollection.schema as z.ZodObject<z.ZodRawShape>),
  },
};

// Strip server-only columns (user_id, server_seq) to produce the client-facing record.
export function toWireRecord(row: Record<string, unknown>): Record<string, unknown> {
  const { userId: _userId, serverSeq: _serverSeq, ...rest } = row;
  return rest;
}
