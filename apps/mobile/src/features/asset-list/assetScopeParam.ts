import type { AssetQueryScope } from '@/sync/assetSql';

/**
 * An asset query's scope as the asset screen's `scope` URL param: a named one as it is (`library`,
 * `favorites`, `deleted`), an id scope as `<kind>:<id>` (`album:<id>`, `post:<id>`, `asset:<id>`,
 * `contact:<id>`). assetScopeFromParam reads it back.
 */
export function assetScopeToParam(scope: AssetQueryScope): string {
  if (typeof scope === 'string') return scope;
  if ('albumId' in scope) return `album:${scope.albumId}`;
  if ('postId' in scope) return `post:${scope.postId}`;
  if ('assetId' in scope) return `asset:${scope.assetId}`;
  return `contact:${scope.contactId}`;
}

/**
 * The scope an asset screen's `scope` URL param names (assetScopeToParam's form). A kind it doesn't
 * know reads as the library, so a stale link still opens.
 */
export function assetScopeFromParam(param: string): AssetQueryScope {
  const [kind, id] = param.split(':');
  if (id) {
    if (kind === 'album') return { albumId: id };
    if (kind === 'post') return { postId: id };
    if (kind === 'asset') return { assetId: id };
    if (kind === 'contact') return { contactId: id };
    return 'library';
  }
  return kind === 'favorites' || kind === 'deleted' ? kind : 'library';
}
