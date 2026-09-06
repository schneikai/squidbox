import useFilter from '@/hooks/useFilter';

function matchPost(post, activeFilter) {
  if (activeFilter.includes('favorites') && !post.isFavorite) return false;
  return true;
}

export default function useFilterPostsAction({ afterFilter } = {}) {
  return useFilter(matchPost, { afterFilter });
}
