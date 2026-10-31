import { z } from 'zod';

// Epoch ms; a safe integer, which the server's bigint column holds exactly.
export const timestampSchema = z.number().int().safe();

// The server's integer (int4) columns.
export const int4Schema = z
  .number()
  .int()
  .min(-(2 ** 31))
  .max(2 ** 31 - 1);

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

export interface CollectionDescriptor<S extends z.ZodTypeAny = z.ZodTypeAny, L extends z.ZodRawShape = z.ZodRawShape> {
  /** Collection name = table name on both server (Postgres) and client (SQLite). */
  name: string;
  /** Synced fields (includes the base columns). Validated on push; inferred on both sides. */
  schema: S;
  /** Client-only fields, never sent over the wire (e.g. per-device syncError). */
  localOnly: L;
  /** Synced fields that change together: an edit of one sends the whole group with one clock. */
  fieldGroups: readonly (readonly string[])[];
  /** A write-once field set only on a deleted record, which it freezes (e.g. purgedAt, sync-design §7). */
  finalField?: string;
  /** The fields that merge one by one: every synced field but `id`, `createdAt` and `updatedAt`. */
  readonly mergeFields: readonly string[];
  /** The merge fields with a clock of their own: all but the final field, which goes with deletedAt. */
  readonly clockedFields: readonly string[];
}

/** Define a sync collection once — the single source of truth shared by app and server. */
export function defineCollection<S extends z.ZodTypeAny, L extends z.ZodRawShape = z.ZodRawShape>(config: {
  name: string;
  schema: S;
  localOnly?: L;
  fieldGroups?: readonly (readonly string[])[];
  finalField?: string;
}): CollectionDescriptor<S, L> {
  const { shape } = config.schema as unknown as z.ZodObject<z.ZodRawShape>;
  const mergeFields = Object.keys(shape).filter((key) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt');
  return {
    name: config.name,
    schema: config.schema,
    localOnly: (config.localOnly ?? {}) as L,
    fieldGroups: config.fieldGroups ?? [],
    finalField: config.finalField,
    mergeFields: Object.freeze(mergeFields),
    clockedFields: Object.freeze(mergeFields.filter((field) => field !== config.finalField)),
  };
}
