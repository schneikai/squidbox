import { use } from 'react';

import RandomSuggestionsContext from './RandomSuggestionsContext';

export default function useRandomSuggestions() {
  return use(RandomSuggestionsContext);
}
