import ASSET_SCOPE_KINDS, { type IdScope } from './assetScopeKinds';

import type { AssetQueryScope } from '@/sync/assetSql';

// The keys by kind.
const keyOfKind = new Map<string, string>(Object.entries(ASSET_SCOPE_KINDS).map(([key, kind]) => [kind, key]));

/**
 * The scope an asset screen's `scope` URL param names (assetScopeToParam's form). A kind it doesn't
 * know reads as the library, so a stale link still opens.
 */
export default function assetScopeFromParam(param: string): AssetQueryScope {
  const [kind, id] = param.split(':');
  if (id) {
    const key = keyOfKind.get(kind);
    // The key is one of ASSET_SCOPE_KINDS', so this is that key's id scope.
    return key ? ({ [key]: id } as IdScope) : 'library';
  }
  return kind === 'favorites' || kind === 'deleted' ? kind : 'library';
}
