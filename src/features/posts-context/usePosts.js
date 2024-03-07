import { useContext } from 'react';

import PostsContext from './PostsContext';

export default function usePosts() {
  return useContext(PostsContext);
}
