import { type AssetQueryDescriptor, isAssetFilter } from './assetQuery';
import { assetScopeFromParam } from './assetScopeParam';

import listParam from '@/lib/listParam';
import { isAssetSort } from '@/sync/assetSql';

type AssetParams = { scope?: string; sort?: string; filter?: string; search?: string };

/**
 * The grid's query (assetQuery's descriptor) from the asset screen's URL params (assetHref). A sort
 * or filter it doesn't know is left out, as the query ignored it.
 */
export default function assetQueryFromParams({
  scope = 'library',
  sort,
  filter,
  search,
}: AssetParams): AssetQueryDescriptor {
  return {
    scope: assetScopeFromParam(scope),
    sort: isAssetSort(sort) ? sort : undefined,
    filter: listParam(filter).filter(isAssetFilter),
    search,
  };
}
