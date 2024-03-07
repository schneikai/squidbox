import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import usePosts from '@/features/posts-context/usePosts';
import writeLocalDataAsync from '@/utils/local-data/writeLocalDataAsync';

export default function useCreateAlbumPostHistory() {
  const { assets } = useAssets();
  const { albums } = useAlbums();
  const { posts } = usePosts();

  async function createAlbumPostHistoryAsync() {
    const allAlbums = { ...albums };
    const allAssets = { ...assets };

    // add postHistory prop to all albums
    for (const album of Object.values(allAlbums)) {
      album.postHistory = [];
    }

    // add postHistory prop to all assets
    for (const asset of Object.values(allAssets)) {
      asset.postHistory = [];
    }

    // build post history for assets and albums
    for (const post of Object.values(posts)) {
      for (const assetRef of post.assetRefs) {
        // update asset post history
        const asset = allAssets[assetRef.assetId];
        if (asset) {
          if (!asset.postHistory.includes(post.id)) {
            asset.postHistory.push(post.id);
          }
        }

        // update album post history
        const assetAlbums = getAlbumsByAssetId(assetRef.assetId, allAlbums);
        for (const album of assetAlbums) {
          if (!album.postHistory.includes(post.id)) {
            album.postHistory.push(post.id);
          }
        }
      }
    }

    // sort post history and set lastPostedAt for assets
    for (const asset of Object.values(allAssets)) {
      asset.postHistory.sort((a, b) => {
        return posts[a].postedAt - posts[b].postedAt;
      });
      if (asset.postHistory.length > 0) {
        const lastPost = posts[asset.postHistory[asset.postHistory.length - 1]];
        asset.lastPostedAt = lastPost.postedAt;
      } else {
        asset.lastPostedAt = null;
      }
    }

    // sort post history and set lastPostedAt for albums
    for (const album of Object.values(allAlbums)) {
      album.postHistory.sort((a, b) => {
        return posts[a].postedAt - posts[b].postedAt;
      });
      if (album.postHistory.length > 0) {
        const lastPost = posts[album.postHistory[album.postHistory.length - 1]];
        album.lastPostedAt = lastPost.postedAt;
      } else {
        album.lastPostedAt = null;
      }
    }

    await writeLocalDataAsync('assets.json', allAssets);
    await writeLocalDataAsync('albums.json', allAlbums);

    console.log('Done!');
  }

  function getAlbumsByAssetId(assetId, albums) {
    return Object.values(albums).filter((album) => album.assets.includes(assetId));
  }

  return createAlbumPostHistoryAsync;
}
