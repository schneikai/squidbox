import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import usePosts from '@/features/posts-context/usePosts';

export default function useInitializeLocalData() {
  const { loadAssetsAsync } = useAssets();
  const { loadAlbumsAsync } = useAlbums();
  const { loadPostsAsync } = usePosts();

  return async function initializeLocalDataAsync() {
    await loadAssetsAsync();
    await loadAlbumsAsync();
    await loadPostsAsync();
  };
}
