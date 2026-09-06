// Sync protocol wire contract (sync-design §5/§6). Per-collection record validation happens
// server-side against each collection's descriptor schema, so records are loosely typed here.
import { z } from 'zod';

const syncRecord = z.record(z.string(), z.unknown());

// --- Pull ---
export const pullRequestSchema = z.object({
  cursor: z.number().int().nonnegative().default(0), // 0 = first/full sync
  limit: z.number().int().positive().max(1000).optional(),
});
export type PullRequest = z.infer<typeof pullRequestSchema>;

export const pullResponseSchema = z.object({
  changes: z.record(z.string(), z.object({ records: z.array(syncRecord) })),
  cursor: z.number(), // new high-water mark (server_seq of last included row)
  hasMore: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;

// --- Push ---
export const pushMutationSchema = z.object({
  collection: z.string(),
  record: syncRecord, // whole-record upsert of synced fields
});
export type PushMutation = z.infer<typeof pushMutationSchema>;

export const pushRequestSchema = z.object({
  mutations: z.array(pushMutationSchema).min(1).max(500),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResultStatus = z.enum(['applied', 'skipped-lww', 'rejected']);
export type PushResultStatus = z.infer<typeof pushResultStatus>;

export const pushResultSchema = z.object({
  id: z.string(),
  collection: z.string(),
  status: pushResultStatus,
  // skipped-lww: the server's winning record, which the client adopts (sync-design §6).
  current: syncRecord.optional(),
  // rejected: why (e.g. "schema:…" or "unknown-collection").
  reason: z.string().optional(),
});
export type PushResult = z.infer<typeof pushResultSchema>;

export const pushResponseSchema = z.object({
  results: z.array(pushResultSchema),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;
