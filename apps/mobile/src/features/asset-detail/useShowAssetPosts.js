import usePostsQuery from '@/features/post-list/posts-query/usePostsQuery';

/** Opens the posts tab searched to the posts of one asset: `showAssetPosts(assetId)`. */
export default function useShowAssetPosts(navigation) {
  const { setPostsQuery } = usePostsQuery();

  return function showAssetPosts(assetId) {
    setPostsQuery(`asset:${assetId}`);
    navigation.navigate('PostsTab', { screen: 'PostsScreen' });
  };
}
