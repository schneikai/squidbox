import type { AssetQueryScope } from '@/sync/assetSql';

type IdScope = Exclude<AssetQueryScope, string>;
type KeyOf<Scope> = Scope extends IdScope ? keyof Scope : never;

// Each id scope's kind in the param, by its key (`satisfies` keeps it whole): the one map both
// directions read, through string-keyed views.
const KIND_OF_KEY = {
  albumId: 'album',
  postId: 'post',
  assetId: 'asset',
  contactId: 'contact',
} as const satisfies Record<KeyOf<IdScope>, string>;
const kindOfKey: Record<string, string> = KIND_OF_KEY;
const keyOfKind = new Map<string, string>(Object.entries(KIND_OF_KEY).map(([key, kind]) => [kind, key]));

/**
 * An asset query's scope as the asset screen's `scope` URL param: a named one as it is (`library`,
 * `favorites`, `deleted`), an id scope as `<kind>:<id>` (`album:<id>`, `post:<id>`, `asset:<id>`,
 * `contact:<id>`). assetScopeFromParam reads it back.
 */
export function assetScopeToParam(scope: AssetQueryScope): string {
  if (typeof scope === 'string') return scope;
  const [[key, id]] = Object.entries(scope);
  return `${kindOfKey[key]}:${id}`;
}

/**
 * The scope an asset screen's `scope` URL param names (assetScopeToParam's form). A kind it doesn't
 * know reads as the library, so a stale link still opens.
 */
export function assetScopeFromParam(param: string): AssetQueryScope {
  const [kind, id] = param.split(':');
  if (id) {
    const key = keyOfKind.get(kind);
    // The key is one of KIND_OF_KEY's, so this is that key's id scope.
    return key ? ({ [key]: id } as IdScope) : 'library';
  }
  return kind === 'favorites' || kind === 'deleted' ? kind : 'library';
}
