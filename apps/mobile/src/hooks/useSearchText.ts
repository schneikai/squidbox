import { useDeferredValue, useState } from 'react';

/**
 * A search field's text: `field`, the props that control the input (`value`, `onChangeText`), and
 * `searchText`, a deferred copy of the typed text for filtering, so typing stays smooth on large lists.
 */
export default function useSearchText() {
  // Plain state on purpose: it controls a text input, and React can't drive one from a transition.
  const [typedText, setTypedText] = useState('');
  const searchText = useDeferredValue(typedText);

  return { field: { value: typedText, onChangeText: setTypedText }, searchText };
}
