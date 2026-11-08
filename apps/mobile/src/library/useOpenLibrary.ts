import type { OpenLibrary } from './current';
import type { Library } from './registry';
import useLibrary from './useLibrary';

export type OpenLibraryValue = {
  library: Library;
  paths: OpenLibrary;
  // The account the library belongs to; null for this device's own library, which has none.
  userId: string | null;
};

/**
 * The open library, for what renders below LibraryGate (app/_layout.tsx), where one always is: a
 * switch unmounts everything below it first. Throws outside it, like getLibrary().
 */
export default function useOpenLibrary(): OpenLibraryValue {
  const { library, paths } = useLibrary();
  if (!library || !paths) throw new Error('No library is open (see LibraryGate in app/_layout.tsx).');
  return { library, paths, userId: library.owner.kind === 'account' ? library.owner.userId : null };
}
