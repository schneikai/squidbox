import type { FieldClocks } from '../contracts/sync';
import type { CollectionDescriptor } from './define';
import { lostFields } from './lostFields';
import { mergeFields } from './mergeFields';

type Row = Record<string, unknown> & { updatedAt: number };

export interface MergeInput {
  /** The stored record, or undefined when the sent one is new. */
  stored: Row | undefined;
  /** The stored record's clocks: one for every merge field but the final one, plus restore marks. */
  storedClocks: FieldClocks;
  sent: Row;
  /** The sent fields' clocks, widened to their field groups. */
  sentClocks: FieldClocks;
  /** A push without fields (an app from before per-field merge): it keeps its whole-record rule for the deletion pair. */
  wholeRecord?: boolean;
  /** Whether a purged stored record is final (on the server it always is; a library merge passes false for a pending purge). */
  storedPurgeFinal?: boolean;
}

export interface MergeResult {
  record: Row;
  clocks: FieldClocks;
  /** The sent fields that applied. */
  applied: string[];
  /** The sent fields the merged record holds with another value, and the final field when the sent record lacks the merged record's. */
  lost: string[];
}

/** The mark of a deletion a restore undid, kept with the clocks so a purge made of it loses (sync-design §7). */
export const restoredMark = (deletedAt: unknown) => `deletedAt:restored:${deletedAt}`;

/**
 * Merges a sent record into the stored one, field by field (sync-design §7): a field applies when its
 * clock is newer; the deletion pair (deletedAt with the final field, a purge) follows the purge rule;
 * a record with a final purge is frozen.
 */
export function mergeRecord(
  descriptor: CollectionDescriptor,
  { stored, storedClocks, sent, sentClocks, wholeRecord = false, storedPurgeFinal = true }: MergeInput,
): MergeResult {
  const final = descriptor.finalField;
  const sentFields = mergeFields(descriptor).filter((field) => field in sentClocks && field in sent);
  if (!stored) {
    const clocks = Object.fromEntries(
      sentFields.filter((field) => field !== final).map((field) => [field, sentClocks[field]!]),
    );
    const updatedAt = Math.max(sent.updatedAt, ...Object.values(clocks));
    return { record: { ...sent, updatedAt }, clocks, applied: sentFields, lost: [] };
  }

  const frozen = final !== undefined && stored[final] != null && storedPurgeFinal;
  const values: Record<string, unknown> = {};
  const clocks: FieldClocks = { ...storedClocks };
  const take = (field: string) => {
    values[field] = sent[field];
    if (field !== final) clocks[field] = sentClocks[field]!;
  };
  const newer = (field: string) => sentClocks[field]! > (storedClocks[field] ?? 0);
  const pair = final !== undefined ? ['deletedAt', final] : [];
  if (!frozen) {
    for (const field of sentFields) if (!pair.includes(field) && newer(field)) take(field);
    if (final !== undefined && (sentFields.includes('deletedAt') || sentFields.includes(final)))
      mergeDeletion(final, stored, sent, newer('deletedAt'), wholeRecord, storedClocks, take);
  }

  if (values.deletedAt === null && stored.deletedAt != null) clocks[restoredMark(stored.deletedAt)] = clocks.deletedAt!;
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
  return { record, clocks, applied, lost };
}

// The deletion pair (sync-design §7): a purge made of a deletion a restore undid since loses, with its
// deletedAt; otherwise the pair goes by deletedAt's clock, a purge also applies to a record still
// deleted, and a deletion doesn't replace a pending purge, which only a restore undoes.
function mergeDeletion(
  final: string,
  stored: Row,
  sent: Row,
  sentNewer: boolean,
  wholeRecord: boolean,
  storedClocks: FieldClocks,
  take: (field: string) => void,
): void {
  const sentPurge = sent[final] != null;
  const storedPurge = stored[final] != null;
  if (sentPurge && sent.deletedAt == null) return; // a purge goes with its deletion
  if (sentPurge && !wholeRecord && stored.deletedAt == null && restoredMark(sent.deletedAt) in storedClocks) return;
  if (!sentNewer) {
    if (sentPurge && !storedPurge && stored.deletedAt != null) take(final);
    return;
  }
  if (storedPurge && sent.deletedAt != null) return;
  take('deletedAt');
  if (!storedPurge || sent.deletedAt == null) take(final);
}
