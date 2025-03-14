import getPostAssets from './queries/getPostAssets';
import getAlbumsByAssetIds from '@/utils/albums/queries/getAlbumsByAssetIds';

export default function getLatestPostDate(post, assets, albums) {
  // Get most recent lastPostedAt from post assets
  const postAssets = getPostAssets(post, assets);
  const latestAssetDate = Math.max(...postAssets.map(asset => asset.lastPostedAt || 0));

  // Get most recent lastPostedAt from albums containing any of the post's assets
  const postAlbums = getAlbumsByAssetIds(post.assetRefs.map(ref => ref.assetId), albums);
  const latestAlbumDate = postAlbums.reduce((max, album) => Math.max(max, album.lastPostedAt || 0), 0);

  // Return most recent date between post suggest date, assets and albums
  return Math.max(
    post.suggestRepostAt || 0,
    latestAssetDate,
    latestAlbumDate
  );
} 