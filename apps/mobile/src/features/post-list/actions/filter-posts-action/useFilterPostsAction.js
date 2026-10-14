import useFilter from '@/hooks/useFilter';

export default function useFilterPostsAction({ afterFilter } = {}) {
  return useFilter({ afterFilter });
}
