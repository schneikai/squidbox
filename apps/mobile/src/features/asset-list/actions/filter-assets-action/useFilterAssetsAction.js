import useFilter from '@/hooks/useFilter';

export default function useFilterAssetsAction({ afterFilter } = {}) {
  return useFilter({ afterFilter });
}
