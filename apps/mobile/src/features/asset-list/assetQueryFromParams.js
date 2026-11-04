import assetScopeKinds from './assetScopeKinds';

import listParam from '@/lib/listParam';

/** The grid's query (assetQuery's descriptor) from the asset screen's URL params (assetHref). */
export default function assetQueryFromParams({ scope = 'library', sort, filter, search }) {
  const [kind, id] = scope.split(':');
  return {
    scope: id ? { [assetScopeKinds[kind]]: id } : kind,
    sort,
    filter: listParam(filter),
    search,
  };
}
