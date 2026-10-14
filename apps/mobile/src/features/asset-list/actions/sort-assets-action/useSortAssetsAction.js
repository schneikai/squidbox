import useSort from '@/hooks/useSort';

export default function useSortAssetsAction({ afterSort } = {}) {
  const { sortOrder, sort } = useSort('createdAt:desc', { afterSort });
  return { sortOrder, sortAssets: sort };
}
