import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import usePosts from '@/features/posts-context/usePosts';

/**
 * Rebuilds postHistory and lastPostedAt for every asset and album purely from
 * the current posts. Useful to repair data that drifted out of sync.
 */
export default function useRecalculatePostHistory() {
  const { assets, updateManyAssets } = useAssets();
  const { albums, updateManyAlbums } = useAlbums();
  const { posts } = usePosts();

  async function recalculatePostHistoryAsync() {
    const albumIdsByAssetId = {};
    for (const album of Object.values(albums)) {
      for (const assetId of album.assets) {
        if (!albumIdsByAssetId[assetId]) albumIdsByAssetId[assetId] = [];
        albumIdsByAssetId[assetId].push(album.id);
      }
    }

    const assetHistory = {};
    const albumHistory = {};

    const sortedPosts = Object.values(posts)
      .filter((post) => !post.isDeleted)
      .sort((a, b) => (a.postedAt ?? 0) - (b.postedAt ?? 0));

    for (const post of sortedPosts) {
      const seenAlbums = new Set();
      for (const assetRef of post.assetRefs) {
        const assetId = assetRef.assetId;

        if (assets[assetId]) {
          if (!assetHistory[assetId]) assetHistory[assetId] = [];
          assetHistory[assetId].push(post.id);
        }

        for (const albumId of albumIdsByAssetId[assetId] ?? []) {
          if (seenAlbums.has(albumId)) continue;
          seenAlbums.add(albumId);
          if (!albumHistory[albumId]) albumHistory[albumId] = [];
          albumHistory[albumId].push(post.id);
        }
      }
    }

    const assetUpdates = buildUpdates(Object.values(assets), assetHistory, posts);
    const albumUpdates = buildUpdates(
      Object.values(albums).filter((album) => !album.smartAlbumType),
      albumHistory,
      posts,
    );

    await updateManyAssets(assetUpdates);
    await updateManyAlbums(albumUpdates);
  }

  return recalculatePostHistoryAsync;
}

function buildUpdates(items, historyById, posts) {
  const updates = {};

  for (const item of items) {
    const postHistory = historyById[item.id] ?? [];
    const lastPostId = postHistory[postHistory.length - 1];
    updates[item.id] = {
      postHistory,
      lastPostedAt: lastPostId ? posts[lastPostId]?.postedAt ?? null : null,
    };
  }

  return updates;
}
