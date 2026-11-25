import assetScopeToParam from './assetScopeToParam';

import type { AssetQueryDescriptor } from '@/sync/queries/assetQuery';

/**
 * The asset screen's href for `assetId` in the grid's query (assetQuery's descriptor), as URL
 * params: `scope` (assetScopeToParam's form), `sort`, `filter` (comma-separated) and `search`.
 * assetQueryFromParams reads them back. With `ids` (a list the grid doesn't come from, like a post
 * editor's strip) the screen swipes through those, in that order, as the scope keeps them by their
 * deletion, instead of the query's.
 */
export default function assetHref(
  assetId: string,
  {
    scope = 'library',
    sort,
    filter = [],
    search = '',
  }: Pick<AssetQueryDescriptor, 'scope' | 'sort' | 'filter' | 'search'>,
  ids: readonly string[] = [],
) {
  const params: Record<string, string> = { assetId, scope: assetScopeToParam(scope) };
  if (sort) params.sort = sort;
  if (filter.length) params.filter = filter.join(',');
  if (search) params.search = search;
  if (ids.length) params.ids = ids.join(',');
  return { pathname: '/asset/[assetId]', params } as const;
}
