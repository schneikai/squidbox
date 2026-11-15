import type { PushMutation } from '@squidbox/shared';

type PulledCopy = Record<string, unknown> & { id: string; postId: string };

/**
 * How the mock data's reset puts a mock post's Send to channels cards back to untouched: every
 * pulled post_copies record of a kept post (`keptPostIds`) that is not in the mock set (`keptIds`),
 * live or already deleted (a removed channel is a tombstone, and keeps the card away), is tombstoned
 * and moved off its post: its `postId` becomes its own id, an id no post has (the app reads copies by
 * `postId`). A mock copy and a copy of another post are left out.
 */
export function mockCopyResets(
  records: PulledCopy[],
  keptIds: ReadonlySet<string>,
  keptPostIds: ReadonlySet<string>,
  now: number,
): PushMutation[] {
  return records
    .filter((record) => !keptIds.has(record.id) && keptPostIds.has(record.postId))
    .map((record) => ({
      collection: 'post_copies',
      record: { ...record, postId: record.id, deletedAt: record.deletedAt ?? now, updatedAt: now },
    }));
}
