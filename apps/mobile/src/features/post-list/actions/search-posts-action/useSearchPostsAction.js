import { useTransition } from 'react';

import useAppSettings from '@/features/app-settings/useAppSettings';

export default function useSearchPostsAction() {
  const { postsQuery, setPostsQuery } = useAppSettings();
  const [, startTransition] = useTransition();

  function setSearchText(text) {
    startTransition(() => setPostsQuery(text));
  }

  function clearSearch() {
    startTransition(() => setPostsQuery(''));
  }

  return {
    searchText: postsQuery,
    setSearchText,
    clearSearch,
  };
}
