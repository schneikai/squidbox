import { useRoute } from '@react-navigation/native';
import { use } from 'react';

import RandomSuggestionsContext from './RandomSuggestionsContext';

// RandomSuggestionsProvider's functions, `openRandomSuggestions()` opening the calling screen's sheet.
export default function useRandomSuggestions() {
  const { key } = useRoute();
  const { openRandomSuggestions, finishRandomSuggestions } = use(RandomSuggestionsContext);
  return { openRandomSuggestions: () => openRandomSuggestions(key), finishRandomSuggestions };
}
