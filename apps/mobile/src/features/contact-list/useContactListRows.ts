import contactListQuery from './contactListQuery';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The contact lists, by name, live, with their member counts and, `withMembers`, their first
 * members (contactListQuery); undefined while reading.
 */
export default function useContactListRows({ withMembers }: { withMembers?: boolean } = {}) {
  const query = contactListQuery({ withMembers });
  return useLiveQuery((db) => query.read(db), query.tables, [query.descriptor]);
}
