import { useEffect, useState } from 'react';

import useAppSettings from '@/features/app-settings/useAppSettings';

export default function useSearchPostsAction() {
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(false);
  // const [searchText, setSearchText] = useState('');
  const { postsQuery, setPostsQuery } = useAppSettings();

  useEffect(() => {
    if (!isSearchBarVisible) {
      setPostsQuery('');
    }
  }, [isSearchBarVisible]);

  useEffect(() => {
    if (postsQuery) {
      setIsSearchBarVisible(true);
    }
  }, [postsQuery]);

  function toggleSearchBar() {
    setIsSearchBarVisible((isSearchBarVisible) => !isSearchBarVisible);
  }

  return {
    isSearchBarVisible,
    searchText: postsQuery,
    setSearchText: setPostsQuery,
    toggleSearchBar,
  };
}
