import { useRef } from 'react';

import useAlbums from '@/features/albums-context/useAlbums';
import useAssets from '@/features/assets-context/useAssets';
import getAlbumsByAssetIds from '@/utils/albums/queries/getAlbumsByAssetIds';

export default function useUpdatePostHistory({ getPosts }) {
  const { assets, updateAsset } = useAssets();
  const { albums, updateAlbum } = useAlbums();

  // Keep the latest context values in a ref so the callbacks below always read
  // fresh data. Without this they would capture stale albums/assets whenever a
  // parent memoizes them (e.g. PostsProvider memoizes on posts only), which
  // caused album lastPostedAt to not update after posting.
  const latest = useRef();
  latest.current = { assets, updateAsset, albums, updateAlbum, getPosts };

  async function addPostHistoryAsync(post) {
    const { assets, updateAsset, albums, updateAlbum } = latest.current;
    const assetIds = post.assetRefs.map((assetRef) => assetRef.assetId);

    // Update post history and last posted at for all assets that were posted
    const updateableAssets = assetIds.map((assetId) => assets[assetId]).filter(Boolean);
    for (const asset of updateableAssets) {
      await updateAsset(asset.id, { postHistory: asset.postHistory.concat(post.id), lastPostedAt: post.postedAt });
    }

    // Update post history and last posted at for all albums that contain the posted assets
    const updateableAlbums = getAlbumsByAssetIds(assetIds, albums);
    for (const album of updateableAlbums) {
      await updateAlbum(album.id, { postHistory: album.postHistory.concat(post.id), lastPostedAt: post.postedAt });
    }
  }

  async function removePostHistoryAsync(post) {
    const { assets, updateAsset, albums, updateAlbum } = latest.current;
    const assetIds = post.assetRefs.map((assetRef) => assetRef.assetId);

    // Update post history and last posted at for all assets that were posted
    const updateableAssets = assetIds.map((assetId) => assets[assetId]).filter(Boolean);
    for (const asset of updateableAssets) {
      const newPostHistory = asset.postHistory.filter((postId) => postId !== post.id);
      const lastPostedAt = getLastPostedAt(newPostHistory);
      await updateAsset(asset.id, { postHistory: newPostHistory, lastPostedAt });
    }

    // Update post history and last posted at for all albums that contain the posted assets
    const updateableAlbums = getAlbumsByAssetIds(assetIds, albums);
    for (const album of updateableAlbums) {
      const newPostHistory = album.postHistory.filter((postId) => postId !== post.id);
      const lastPostedAt = getLastPostedAt(newPostHistory);
      await updateAlbum(album.id, { postHistory: newPostHistory, lastPostedAt });
    }
  }

  function getLastPostedAt(postHistory) {
    if (postHistory.length === 0) return null;

    const posts = latest.current.getPosts();
    const lastPost = posts[postHistory[postHistory.length - 1]];
    return lastPost?.postedAt;
  }

  return { addPostHistoryAsync, removePostHistoryAsync };
}
