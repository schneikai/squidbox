import useAccountUserId from '@/library/useAccountUserId';
import { schema } from '@/sync/db/client';
import { readPersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The library owner's persona ("Writing as you"), live: null before the first save, undefined while reading. */
export default function usePersona() {
  const userId = useAccountUserId();
  return useLiveQuery((db) => readPersona(db, userId), [schema.personas], [userId]);
}
