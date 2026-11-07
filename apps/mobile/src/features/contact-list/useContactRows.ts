import contactQuery, { type ContactDescriptor } from './contactQuery';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The contacts of `descriptor` (contactQuery's), live, as what a row, chip or avatar shows of them
 * (contactQuery's summaries); undefined while reading. `isLive: false` stops re-reading them
 * (useLiveQuery's), say while they are hidden.
 */
export default function useContactRows(
  descriptor: ContactDescriptor,
  { isLive, limit }: { isLive?: boolean; limit?: number } = {},
) {
  const query = contactQuery(descriptor);
  return useLiveQuery(
    (db) => (limit === undefined ? query.summaries(db) : query.read(db, { limit }).then(({ rows }) => rows)),
    query.tables,
    [query.descriptor, limit],
    { isLive },
  );
}
