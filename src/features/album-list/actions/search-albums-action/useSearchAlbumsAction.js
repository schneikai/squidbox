import { useEffect, useState } from 'react';

export default function useSearchAlbumsAction() {
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!isSearchBarVisible) {
      setSearchText('');
    }
  }, [isSearchBarVisible]);

  function toggleSearchBar() {
    setIsSearchBarVisible((isSearchBarVisible) => !isSearchBarVisible);
  }

  return {
    isSearchBarVisible,
    searchText,
    setSearchText,
    toggleSearchBar,
  };
}
