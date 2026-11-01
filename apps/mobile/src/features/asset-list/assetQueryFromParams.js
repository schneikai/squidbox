const SCOPE_KEYS = { album: 'albumId', post: 'postId', asset: 'assetId' };

/** The grid's query (assetQuery's descriptor) from the asset screen's URL params (assetHref). */
export default function assetQueryFromParams({ scope = 'library', sort, filter, search }) {
  const [kind, id] = scope.split(':');
  return {
    scope: id ? { [SCOPE_KEYS[kind]]: id } : kind,
    sort,
    filter: filter ? filter.split(',') : [],
    search,
  };
}
