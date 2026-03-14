import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';

import SuperPressable from '@/components/SuperPressable';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import preparePosts from '@/features/post-list/preparePosts';
import usePosts from '@/features/posts-context/usePosts';

export default function AlbumPostsView({ album, paddingBottom }) {
  const navigation = useNavigation();
  const { posts } = usePosts();

  const postIds = useMemo(
    () =>
      preparePosts({
        posts: Object.values(posts),
        albums: { [album.id]: album },
        searchText: `album:${album.id}`,
        sortFn: (a, b) => b.postedAt - a.postedAt,
      }).map((post) => post.id),
    [posts, album],
  );

  return (
    <PostList
      postIds={postIds}
      contentContainerStyle={{ paddingBottom }}
      renderListItem={(post) => (
        <SuperPressable
          onPress={() => navigation.navigate('PostScreen', { postId: post.id })}
          style={{ flex: 1 }}
        >
          <PostListItem {...post} />
        </SuperPressable>
      )}
    />
  );
}
