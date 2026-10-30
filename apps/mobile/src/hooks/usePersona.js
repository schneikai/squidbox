import useLibrary from '@/library/useLibrary';
import { schema } from '@/sync/db/client';
import { readPersona } from '@/sync/personaRepository';
import { useLiveQuery } from '@/sync/useLiveQuery';

/** The library owner's persona ("Writing as you"), live: null before the first save, undefined while reading. */
export default function usePersona() {
  const { library } = useLibrary();
  const userId = library.owner.userId;
  return useLiveQuery((db) => readPersona(db, userId), [schema.personas], [userId]);
}
