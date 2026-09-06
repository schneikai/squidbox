import { use } from 'react';

import PostsContext from './PostsContext';

export default function usePosts() {
  return use(PostsContext);
}
