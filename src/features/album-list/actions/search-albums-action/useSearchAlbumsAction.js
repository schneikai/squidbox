import { useState, useTransition } from 'react';

export default function useSearchAlbumsAction() {
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [, startTransition] = useTransition();

  function toggleSearchBar() {
    setIsSearchBarVisible((prev) => {
      if (prev) startTransition(() => setSearchText(''));
      return !prev;
    });
  }

  function handleSetSearchText(text) {
    startTransition(() => setSearchText(text));
  }

  return {
    isSearchBarVisible,
    searchText,
    setSearchText: handleSetSearchText,
    toggleSearchBar,
  };
}
