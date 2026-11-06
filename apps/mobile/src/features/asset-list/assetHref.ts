import assetScopeKinds, { type AssetScopeKey, type AssetScopeKind } from './assetScopeKinds';

const KIND_BY_KEY = Object.fromEntries(Object.entries(assetScopeKinds).map(([kind, key]) => [key, kind])) as Record<
  AssetScopeKey,
  AssetScopeKind
>;

/** An asset query's scope (assetQuery's): a named one, or one id scope (`{ albumId }`, …). */
export type AssetHrefScope = string | Partial<Record<AssetScopeKey, string>>;

type AssetHrefDescriptor = { scope?: AssetHrefScope; sort?: string; filter?: string[]; search?: string };

/**
 * The asset screen's href for `assetId` in the grid's query (assetQuery's descriptor), as URL
 * params: `scope` (`library`, `favorites`, `deleted`, or `album:<id>`, `post:<id>`, `asset:<id>`, `contact:<id>`),
 * `sort`, `filter` (comma-separated) and `search`. assetQueryFromParams reads them back.
 */
export default function assetHref(
  assetId: string,
  { scope = 'library', sort, filter = [], search = '' }: AssetHrefDescriptor,
) {
  const params: Record<string, string> = { assetId, scope: scopeParam(scope) };
  if (sort) params.sort = sort;
  if (filter.length) params.filter = filter.join(',');
  if (search) params.search = search;
  return { pathname: '/asset/[assetId]', params } as const;
}

function scopeParam(scope: AssetHrefScope): string {
  if (typeof scope === 'string') return scope;
  const [key, id] = Object.entries(scope)[0] as [AssetScopeKey, string];
  return `${KIND_BY_KEY[key]}:${id}`;
}
