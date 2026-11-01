const SCOPE_KEYS = { albumId: 'album', postId: 'post', assetId: 'asset' };

/**
 * The asset screen's href for `assetId` in the grid's query (assetQuery's descriptor), as URL
 * params: `scope` (`library`, `favorites`, `deleted`, or `album:<id>`, `post:<id>`, `asset:<id>`),
 * `sort`, `filter` (comma-separated) and `search`. assetQueryFromParams reads them back.
 */
export default function assetHref(assetId, { scope = 'library', sort, filter = [], search = '' }) {
  const params = { assetId, scope: scopeParam(scope) };
  if (sort) params.sort = sort;
  if (filter.length) params.filter = filter.join(',');
  if (search) params.search = search;
  return { pathname: '/asset/[assetId]', params };
}

function scopeParam(scope) {
  if (typeof scope === 'string') return scope;
  const [key, id] = Object.entries(scope)[0];
  return `${SCOPE_KEYS[key]}:${id}`;
}
