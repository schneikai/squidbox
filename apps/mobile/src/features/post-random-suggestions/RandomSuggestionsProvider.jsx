import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef } from 'react';

import RandomSuggestionsContext from './RandomSuggestionsContext';

export default function RandomSuggestionsProvider({ children }) {
  const navigation = useNavigation();
  const resolversRef = useRef(new Map());

  // Works like useAssetPicker's picker: resolves with the suggestion Use took ({ asset, text }, either
  // may be null), or with null when the sheet closes without Use. One sheet per calling screen (its
  // route's key, which is the sheet route's id): a second tap goes to the sheet already open, while an
  // editor opened inside the sheet opens a sheet of its own.
  const openRandomSuggestions = useCallback(
    (callerKey) =>
      new Promise((resolve) => {
        resolversRef.current.set(callerKey, resolve);
        navigation.navigate('RandomSuggestionsModal', { callerKey });
      }),
    [navigation],
  );

  // Settles a request once: the sheet closing after Use settles it again, which does nothing.
  const finishRandomSuggestions = useCallback((callerKey, suggestion) => {
    resolversRef.current.get(callerKey)?.(suggestion);
    resolversRef.current.delete(callerKey);
  }, []);

  const value = useMemo(
    () => ({ openRandomSuggestions, finishRandomSuggestions }),
    [openRandomSuggestions, finishRandomSuggestions],
  );

  return <RandomSuggestionsContext value={value}>{children}</RandomSuggestionsContext>;
}
