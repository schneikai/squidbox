/**
 * A device library's merge marker (library/mergeRun.ts), in the library list and in the library's own
 * database: the library a merge is adding it to, and that library's account. From the first pass that
 * commits records, the device library belongs to that account: it never joins another account's
 * library, and a library of the same account that replaces a lost one takes it over.
 */
export type MergeMarker = { library: string; serverId: string; userId: string };
