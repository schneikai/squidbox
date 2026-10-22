import { isListed, type Library } from './registry';
import { sameAccount } from './sameAccount';

/**
 * A device library's merge marker (library/mergeRun.ts), in the library list and in the library's own
 * database: the library a merge is adding it to, and that library's account. From the first pass that
 * commits records, the device library belongs to that account: it never joins another account's
 * library, and a library of the same account that replaces a lost one takes it over.
 */
export type MergeMarker = { library: string; serverId: string; userId: string };

// What a library holds of its merges: in the list (Library), or read from its database.
type Markers = { keptFor?: string | null; mergedInto?: MergeMarker | null };

/**
 * What the markers say the library joined, when that keeps it from joining `target` now: kept for a
 * library (never merged again), merging into another library still listed (finished there), or
 * waiting for a library of the account it joined (merged into one of another account's, gone since:
 * nothing of it goes to another account). Null when it may join `target`.
 */
export function joinedElsewhere(
  { keptFor, mergedInto }: Markers,
  target: Library,
): { keptFor: string } | { mergedInto: MergeMarker } | 'waits' | null {
  if (keptFor) return { keptFor };
  if (!mergedInto || mergedInto.library === target.id) return null;
  if (isListed(mergedInto.library)) return { mergedInto };
  return target.owner.kind === 'account' && sameAccount(mergedInto, target.owner) ? null : 'waits';
}
