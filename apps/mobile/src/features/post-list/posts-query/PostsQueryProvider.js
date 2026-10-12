import { useMemo, useState } from 'react';

import PostsQueryContext from './PostsQueryContext';

// The posts screen's search text. Other screens set it too (e.g. "Show posts" on an asset), so it
// lives above navigation, in its own context: typing must not re-render everything that reads
// the app settings, such as every thumbnail.
export default function PostsQueryProvider({ children }) {
  const [postsQuery, setPostsQuery] = useState('');
  const value = useMemo(() => ({ postsQuery, setPostsQuery }), [postsQuery]);
  return <PostsQueryContext.Provider value={value}>{children}</PostsQueryContext.Provider>;
}
