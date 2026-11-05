import { createContext } from 'react';

import type { OpenLibrary } from './current';
import type { Library } from './registry';
import type { SwitchLibrary } from './sessionLibrary';

export type LibraryContextValue = {
  library: Library | null;
  paths: OpenLibrary | null;
  switching: boolean;
  switchLibrary: SwitchLibrary;
  booted: boolean;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export default LibraryContext;
