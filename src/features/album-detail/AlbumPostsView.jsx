import { useNavigation } from '@react-navigation/native';

import SuperPressable from '@/components/SuperPressable';
import PostList from '@/features/post-list/PostList';
import PostListItem from '@/features/post-list/PostListItem';

export default function AlbumPostsView({ postIds, paddingTop, paddingBottom }) {
  const navigation = useNavigation();

  return (
    <PostList
      postIds={postIds}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      renderListItem={(post) => (
        <SuperPressable onPress={() => navigation.navigate('PostScreen', { postId: post.id })} style={{ flex: 1 }}>
          <PostListItem {...post} />
        </SuperPressable>
      )}
    />
  );
}
