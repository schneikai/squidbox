import type { AssetQueryDescriptor } from './assetQuery';
import { assetScopeToParam } from './assetScopeParam';

/**
 * The asset screen's href for `assetId` in the grid's query (assetQuery's descriptor), as URL
 * params: `scope` (assetScopeToParam's form), `sort`, `filter` (comma-separated) and `search`.
 * assetQueryFromParams reads them back.
 */
export default function assetHref(
  assetId: string,
  {
    scope = 'library',
    sort,
    filter = [],
    search = '',
  }: Pick<AssetQueryDescriptor, 'scope' | 'sort' | 'filter' | 'search'>,
) {
  const params: Record<string, string> = { assetId, scope: assetScopeToParam(scope) };
  if (sort) params.sort = sort;
  if (filter.length) params.filter = filter.join(',');
  if (search) params.search = search;
  return { pathname: '/asset/[assetId]', params } as const;
}
