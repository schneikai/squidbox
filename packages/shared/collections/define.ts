import { z } from 'zod';

// Epoch ms; a safe integer, which the server's bigint column holds exactly.
export const timestampSchema = z.number().int().safe();

// A string for a server text column, which can't hold a NUL character.
export const textSchema = z.string().regex(/^[^\0]*$/, 'contains a NUL character');

// Base columns every synced record carries (sync-design §2). Client-generated `id`;
// writer-set epoch-ms clocks; `deletedAt` non-null = tombstone. `user_id`/`server_seq` are
// server-only and never part of the client record schema.
export const baseRecordSchema = z.object({
  id: z.string().uuid(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

export interface CollectionDescriptor<
  S extends z.ZodTypeAny = z.ZodTypeAny,
  L extends z.ZodRawShape = z.ZodRawShape,
> {
  /** Collection name = table name on both server (Postgres) and client (SQLite). */
  name: string;
  /** Synced fields (includes the base columns). Validated on push; inferred on both sides. */
  schema: S;
  /** Client-only fields, never sent over the wire (e.g. per-device syncError). */
  localOnly: L;
}

/** Define a sync collection once — the single source of truth shared by app and server. */
export function defineCollection<S extends z.ZodTypeAny, L extends z.ZodRawShape = z.ZodRawShape>(config: {
  name: string;
  schema: S;
  localOnly?: L;
}): CollectionDescriptor<S, L> {
  return { name: config.name, schema: config.schema, localOnly: (config.localOnly ?? {}) as L };
}
