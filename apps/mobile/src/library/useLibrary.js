import { use } from 'react';

import LibraryContext from './LibraryContext';

export default function useLibrary() {
  return use(LibraryContext);
}
