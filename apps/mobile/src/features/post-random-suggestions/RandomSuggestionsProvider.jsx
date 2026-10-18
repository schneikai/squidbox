import { StackActions, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useRef } from 'react';

import RandomSuggestionsContext from './RandomSuggestionsContext';

export default function RandomSuggestionsProvider({ children }) {
  const navigation = useNavigation();
  const resolversRef = useRef(new Map());
  const lastRequestIdRef = useRef(0);

  // Works like useAssetPicker's picker: resolves with the suggestion Use took ({ asset, text }, either
  // may be null), or with null when the sheet closes without Use. Each opening is its own request: the
  // sheet can open again from an editor opened inside it.
  const openRandomSuggestions = useCallback(
    () =>
      new Promise((resolve) => {
        const requestId = ++lastRequestIdRef.current;
        resolversRef.current.set(requestId, resolve);
        // Pushed, not navigated to, which would go back to a sheet still open below. A dispatch: the
        // navigation outside the navigators has no push.
        navigation.dispatch(StackActions.push('RandomSuggestionsModal', { requestId }));
      }),
    [navigation],
  );

  // Settles a request once: the sheet closing after Use settles it again, which does nothing.
  const finishRandomSuggestions = useCallback((requestId, suggestion) => {
    resolversRef.current.get(requestId)?.(suggestion);
    resolversRef.current.delete(requestId);
  }, []);

  const value = useMemo(
    () => ({ openRandomSuggestions, finishRandomSuggestions }),
    [openRandomSuggestions, finishRandomSuggestions],
  );

  return <RandomSuggestionsContext value={value}>{children}</RandomSuggestionsContext>;
}
