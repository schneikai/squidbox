import { useState, useEffect } from 'react';

import Post from '@/features/post-detail/Post';
import MoreAction from '@/features/post-detail/actions/MoreAction';
import usePosts from '@/features/posts-context/usePosts';
import formatDateTime from '@/utils/date-time/formatDateTime';

export default function PostScreen({ route, navigation }) {
  const { postId } = route.params;
  const { posts } = usePosts();
  const [post, setPost] = useState(null);

  useEffect(() => {
    setPost(posts[postId]);
  }, [posts, postId]);

  useEffect(() => {
    if (!post) return;
    navigation.setOptions({
      title: formatDateTime(post.postedAt),
      headerRight: () => <MoreAction post={post} afterDelete={() => navigation.goBack()} />,
    });
  }, [navigation, post]);

  // TODO: Show post not found
  if (!post) return null;

  return <Post post={post} />;
}
