import contactQuery, { type ContactDescriptor } from '@/sync/queries/contactQuery';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The contacts of `descriptor` (contactQuery's), live, as what a row, chip or avatar shows of them
 * (contactQuery's summaries); undefined while reading. `isLive: false` stops re-reading them
 * (useLiveQuery's), say while they are hidden.
 */
export default function useContactRows(descriptor: ContactDescriptor, { isLive }: { isLive?: boolean } = {}) {
  const query = contactQuery(descriptor);
  return useLiveQuery((db) => query.summaries(db), query.tables, [query.descriptor], { isLive });
}
