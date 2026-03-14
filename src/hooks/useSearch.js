import { useState, useTransition } from 'react';

/**
 * Generic search hook. Manages searchText with React's useTransition for
 * non-blocking updates. Returns { searchText, setSearchText, clearSearch }.
 */
export default function useSearch(initialText = '') {
  const [searchText, setSearchTextState] = useState(initialText);
  const [, startTransition] = useTransition();

  function setSearchText(text) {
    startTransition(() => setSearchTextState(text));
  }

  function clearSearch() {
    startTransition(() => setSearchTextState(''));
  }

  return { searchText, setSearchText, clearSearch };
}
