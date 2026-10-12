import { use } from 'react';

import PostsQueryContext from './PostsQueryContext';

export default function usePostsQuery() {
  return use(PostsQueryContext);
}
