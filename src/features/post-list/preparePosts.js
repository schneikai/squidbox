import isBlank from '@/utils/isBlank';

export default function preparePosts({ posts, albums, sortFn, filterFn, searchText, filterDeleted = true }) {
  // Extract search key and value from searchText (e.g. "asset:123" or "album:456")
  const matched = searchText.match(/(asset|album):([^\s]+)/i);
  const searchKey = matched ? matched[1] : null; // 'asset' or 'album'
  const searchValue = matched ? matched[2] : null; // asset or album id

  let matchedPosts = posts.filter((post) => {
    if (filterDeleted && post.isDeleted) return false;
    if (filterFn && !filterFn(post)) return false;

    // If an assetId is specified in the searchText, only show posts that reference that asset
    if (searchKey === 'asset' && searchValue && !post.assetRefs.some((ref) => ref.assetId === searchValue)) {
      return false;
    }

    // If an albumId is specified in the searchText, only show posts that reference assets from that album
    if (searchKey === 'album' && searchValue) {
      const album = albums[searchValue];
      if (!album || !post.assetRefs.some((ref) => album.assets.includes(ref.assetId))) return false;
    }

    // If searchText is provided but doesn't specify an asset, filter by post text
    if (!isBlank(searchText) && !searchValue && !(post.text || '').toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }

    return true;
  });

  if (sortFn) matchedPosts = matchedPosts.sort(sortFn);

  return matchedPosts;
}
