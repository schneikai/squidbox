import PostsContext, { type PostsContextValue } from './PostsContext';

import useRequiredContext from '@/hooks/useRequiredContext';

export default function usePosts(): PostsContextValue {
  return useRequiredContext(PostsContext, 'usePosts needs a PostsProvider above it');
}
