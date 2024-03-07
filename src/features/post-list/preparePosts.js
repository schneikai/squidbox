import isBlank from '@/utils/isBlank';

export default function preparePosts({ posts, sortFn, filterFn, searchText, filterDeleted = true }) {
  let matchedPosts = posts.filter((post) => {
    if (filterDeleted && post.isDeleted) return false;
    if (filterFn && !filterFn(post)) return false;
    if (!isBlank(searchText) && !(post.text || '').toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  if (sortFn) matchedPosts = matchedPosts.sort(sortFn);

  return matchedPosts;
}
