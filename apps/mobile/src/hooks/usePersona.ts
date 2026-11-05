import useOpenLibrary from '@/library/useOpenLibrary';
import { schema } from '@/sync/db/client';
import { readPersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/**
 * The library owner's persona ("Writing as you"), live: null before the first save (and in this
 * device's library, which has no account), undefined while reading.
 */
export default function usePersona() {
  const { userId } = useOpenLibrary();
  return useLiveQuery(async (db) => (userId === null ? null : readPersona(db, userId)), [schema.personas], [userId]);
}
