import contactListQuery from './contactListQuery';

import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The contact lists, by name, live, with their member counts and, `withMembers`, their first
 * members (contactListQuery); undefined while reading. `isLive: false` stops re-reading them
 * (useLiveQuery's), say while they are hidden.
 */
export default function useContactListRows({ withMembers, isLive } = {}) {
  const query = contactListQuery({ withMembers });
  return useLiveQuery((db) => query.read(db), query.tables, [query.descriptor], { isLive });
}
