import LibraryContext, { type LibraryContextValue } from './LibraryContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function useLibrary(): LibraryContextValue {
  return useRequiredContext(LibraryContext, 'useLibrary needs a LibraryProvider above it');
}
