import type { FieldClocks } from '../contracts/sync';
import { clockedFields } from './clockedFields';
import type { CollectionDescriptor } from './define';
import { lostFields } from './lostFields';
import { mergeFields } from './mergeFields';

type Row = Record<string, unknown> & { updatedAt: number };

export interface MergeInput {
  /** The stored record, or undefined when the sent one is new. */
  stored: Row | undefined;
  /** The stored record's clocks: one for every merge field but the final one. */
  storedClocks: FieldClocks;
  sent: Row;
  /** The sent fields' clocks, widened to their field groups. */
  sentClocks: FieldClocks;
  /**
   * The largest deletedAt a restore of the stored record undid (null for none): a purge made of a
   * deletion up to it loses to the restore. Left out, no purge loses that way (a push without fields,
   * from an app that removed the purged files at once, keeps its whole-record rule).
   */
  restoredThrough?: number | null;
  /** Whether a purged stored record is final (on the server it always is; a library merge passes false for a pending purge). */
  storedPurgeFinal?: boolean;
}

export interface MergeResult {
  record: Row;
  clocks: FieldClocks;
  /** The sent fields that applied: on an insert, every field the record carries. */
  applied: string[];
  /** The sent fields the merged record holds with another value, and the final field when the sent record lacks the merged record's. */
  lost: string[];
  /** `restoredThrough` raised to the deletedAt this merge's restore undid, for a collection with a final field. */
  restoredThrough: number | null;
}

/**
 * Merges a sent record into the stored one, field by field (sync-design §7): a field applies when its
 * clock is newer; the deletion pair (deletedAt with the final field, a purge) follows the purge rule;
 * a record with a final purge is frozen.
 */
export function mergeRecord(
  descriptor: CollectionDescriptor,
  { stored, storedClocks, sent, sentClocks, restoredThrough, storedPurgeFinal = true }: MergeInput,
): MergeResult {
  const final = descriptor.finalField;
  const carried = mergeFields(descriptor).filter((field) => field in sent);
  const sentFields = carried.filter((field) => field in sentClocks);
  if (!stored) {
    const clocks = Object.fromEntries(
      clockedFields(descriptor)
        .filter((field) => sentFields.includes(field))
        .map((field) => [field, sentClocks[field]!]),
    );
    const updatedAt = Math.max(sent.updatedAt, ...Object.values(clocks));
    return { record: { ...sent, updatedAt }, clocks, applied: carried, lost: [], restoredThrough: null };
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
      mergeDeletion(final, stored, sent, newer('deletedAt'), restoredThrough, take);
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
  const undid = final !== undefined && values.deletedAt === null ? (stored.deletedAt as number | null) : null;
  return { record, clocks, applied, lost, restoredThrough: maxOrNull(restoredThrough ?? null, undid) };
}

// The deletion pair (sync-design §7): on a live record, a purge made of a deletion up to
// `restoredThrough` loses with its deletedAt; otherwise the pair goes by deletedAt's clock, a purge
// also applies to a record still deleted, and a deletion doesn't replace a pending purge, which only
// a restore undoes. The final field is taken only from a record that carries it.
function mergeDeletion(
  final: string,
  stored: Row,
  sent: Row,
  sentNewer: boolean,
  restoredThrough: number | null | undefined,
  take: (field: string) => void,
): void {
  const sentPurge = sent[final] != null;
  const storedPurge = stored[final] != null;
  const takeFinal = () => final in sent && take(final);
  if (sentPurge && sent.deletedAt == null) return; // a purge goes with its deletion
  if (sentPurge && stored.deletedAt == null && restoredThrough != null && Number(sent.deletedAt) <= restoredThrough)
    return;
  if (!sentNewer) {
    if (sentPurge && !storedPurge && stored.deletedAt != null) takeFinal();
    return;
  }
  if (storedPurge && sent.deletedAt != null) return;
  take('deletedAt');
  if (!storedPurge || sent.deletedAt == null) takeFinal();
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.max(a, b);
}
