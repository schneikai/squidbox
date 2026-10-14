import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';

import SuperPressable from '@/components/SuperPressable';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';
import postQuery from '@/features/post-list/postQuery';
import { usePagedQuery } from '@/sync/usePagedQuery';

// The album's posts, read only while this tab shows; `onCount` gets their count for the header.
export default function AlbumPostsView({ albumId, onCount, paddingTop, paddingBottom }) {
  const navigation = useNavigation();
  const { rows, count, loadMore } = usePagedQuery(postQuery({ scope: { albumId }, sort: 'postedAt:desc' }), 20);

  useEffect(() => onCount(count), [count]);

  return (
    <PostList
      rows={rows}
      loadMore={loadMore}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      renderListItem={(post) => (
        <SuperPressable onPress={() => navigation.navigate('PostScreen', { postId: post.id })} style={{ flex: 1 }}>
          <PostListItem post={post} />
        </SuperPressable>
      )}
    />
  );
}
