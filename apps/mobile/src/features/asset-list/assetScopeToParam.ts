import ASSET_SCOPE_KINDS from './assetScopeKinds';

import type { AssetQueryScope } from '@/sync/assetSql';

// The kinds by any key, for the key an id scope's entry reads as.
const kindOfKey: Record<string, string> = ASSET_SCOPE_KINDS;

/**
 * An asset query's scope as the asset screen's `scope` URL param: a named one as it is (`library`,
 * `favorites`, `deleted`), an id scope as `<kind>:<id>` (`album:<id>`, `post:<id>`, `asset:<id>`,
 * `contact:<id>`). assetScopeFromParam reads it back.
 */
export default function assetScopeToParam(scope: AssetQueryScope): string {
  if (typeof scope === 'string') return scope;
  const [[key, id]] = Object.entries(scope);
  return `${kindOfKey[key]}:${id}`;
}
