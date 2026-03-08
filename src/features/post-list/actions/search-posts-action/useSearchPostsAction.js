import { useState, useTransition } from 'react';

import useAppSettings from '@/features/app-settings/useAppSettings';

export default function useSearchPostsAction() {
  const { postsQuery, setPostsQuery } = useAppSettings();
  // If a query is already stored in settings, start with the bar visible.
  const [isSearchBarVisible, setIsSearchBarVisible] = useState(() => !!postsQuery);
  const [, startTransition] = useTransition();

  function toggleSearchBar() {
    setIsSearchBarVisible((prev) => {
      if (prev) startTransition(() => setPostsQuery(''));
      return !prev;
    });
  }

  function setSearchText(text) {
    startTransition(() => setPostsQuery(text));
    if (text && !isSearchBarVisible) setIsSearchBarVisible(true);
  }

  return {
    isSearchBarVisible,
    searchText: postsQuery,
    setSearchText,
    toggleSearchBar,
  };
}
