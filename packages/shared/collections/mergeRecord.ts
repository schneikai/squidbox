import type { FieldClocks } from '../contracts/sync';
import { clockedFields } from './clockedFields';
import type { CollectionDescriptor } from './define';
import { lostFields } from './lostFields';
import { mergeFields } from './mergeFields';

type Row = Record<string, unknown> & { updatedAt: number };

// How many undone deletions a record remembers: a purge of an older one goes by the clocks.
const RESTORES_KEPT = 10;

export interface MergeInput {
  /** The stored record, or undefined when the sent one is new. */
  stored: Row | undefined;
  /** The stored record's clocks: one for every merge field but the final one. */
  storedClocks: FieldClocks;
  sent: Row;
  /** The sent fields' clocks, widened to their field groups. */
  sentClocks: FieldClocks;
  /** The last deletedAt values a restore of the stored record undid: on a live record, a purge of one of them loses. */
  restoredDeletions?: number[];
  /**
   * A push without fields (an app from before per-field merge, which removes a purge's files at once):
   * its purge gets no restoredDeletions check, and it loses when the row's updatedAt is newer than its own.
   */
  wholeRecord?: boolean;
  /** Whether a purged stored record is final (on the server it always is; a library merge passes false for a pending purge). */
  storedPurgeFinal?: boolean;
}

export interface MergeResult {
  record: Row;
  clocks: FieldClocks;
  /** The sent fields that applied: on an insert, every field the record carries. */
  applied: string[];
  /**
   * The sent fields the merged record holds with another value, the final field when the sent record
   * lacks the merged record's, and for a whole record `updatedAt` when the merged one is newer, so its
   * sender adopts the row, as a whole-record server answered.
   */
  lost: string[];
  /** The stored `restoredDeletions` with the deletedAt this merge's restore undid, the last RESTORES_KEPT of them. */
  restoredDeletions: number[];
}

/**
 * Merges a sent record into the stored one, field by field (sync-design §7): a field applies when its
 * clock is newer; the deletion pair (deletedAt with the final field, a purge) follows the purge rule;
 * a record with a final purge is frozen.
 */
export function mergeRecord(
  descriptor: CollectionDescriptor,
  {
    stored,
    storedClocks,
    sent,
    sentClocks,
    restoredDeletions = [],
    wholeRecord = false,
    storedPurgeFinal = true,
  }: MergeInput,
): MergeResult {
  const final = descriptor.finalField;
  const carried = mergeFields(descriptor).filter((field) => field in sent);
  const sentFields = carried.filter((field) => field in sentClocks);
  if (!stored) {
    // Every clocked field gets a clock, as the row is written: a sent one, or the record's updatedAt.
    const clocked = clockedFields(descriptor);
    const updatedAt = Math.max(sent.updatedAt, ...clocked.map((field) => sentClocks[field] ?? 0));
    const clocks = Object.fromEntries(clocked.map((field) => [field, sentClocks[field] ?? updatedAt]));
    return { record: { ...sent, updatedAt }, clocks, applied: carried, lost: [], restoredDeletions: [] };
  }

  const frozen = final !== undefined && stored[final] != null && storedPurgeFinal;
  const values: Record<string, unknown> = {};
  const clocks: FieldClocks = { ...storedClocks };
  const take = (field: string) => {
    values[field] = sent[field] ?? null;
    if (field !== final) clocks[field] = sentClocks[field]!;
  };
  const newer = (field: string) => sentClocks[field]! > (storedClocks[field] ?? 0);
  const pair = final !== undefined ? ['deletedAt', final] : [];
  if (!frozen) {
    for (const field of sentFields) if (!pair.includes(field) && newer(field)) take(field);
    if (final !== undefined && (sentFields.includes('deletedAt') || sentFields.includes(final)))
      mergeDeletion(final, stored, sent, newer('deletedAt'), wholeRecord ? [] : restoredDeletions, take);
  }

  const applied = Object.keys(values);
  const appliedClocks = applied.filter((field) => field !== final).map((field) => clocks[field]!);
  const record: Row = { ...stored, ...values, updatedAt: Math.max(stored.updatedAt, ...appliedClocks) };
  const lost = lostFields(sentFields, sent, record);
  if (
    final !== undefined &&
    record[final] != null &&
    !Object.is(sent[final] ?? null, record[final]) &&
    !lost.includes(final)
  )
    lost.push(final);
  if (wholeRecord && record.updatedAt > sent.updatedAt) lost.push('updatedAt');
  const undid = final !== undefined && values.deletedAt === null ? (stored.deletedAt as number | null) : null;
  return {
    record,
    clocks,
    applied,
    lost,
    restoredDeletions:
      undid === null
        ? restoredDeletions
        : [...restoredDeletions.filter((value) => value !== undid), undid].slice(-RESTORES_KEPT),
  };
}

// The deletion pair (sync-design §7): on a live record, a purge made of a deletion a restore undid
// (exactly one of `restoredDeletions`) loses with its deletedAt; otherwise the pair goes by
// deletedAt's clock, a purge also applies to a record still deleted, and a deletion doesn't replace a
// pending purge, which only a restore undoes. The final field is taken only from a record that
// carries it.
function mergeDeletion(
  final: string,
  stored: Row,
  sent: Row,
  sentNewer: boolean,
  restoredDeletions: number[],
  take: (field: string) => void,
): void {
  const sentPurge = sent[final] != null;
  const storedPurge = stored[final] != null;
  const takeFinal = () => final in sent && take(final);
  if (sentPurge && sent.deletedAt == null) return; // a purge goes with its deletion
  if (sentPurge && stored.deletedAt == null && restoredDeletions.includes(Number(sent.deletedAt))) return;
  if (!sentNewer) {
    if (sentPurge && !storedPurge && stored.deletedAt != null) takeFinal();
    return;
  }
  if (storedPurge && sent.deletedAt != null) return;
  take('deletedAt');
  if (!storedPurge || sent.deletedAt == null) takeFinal();
}
