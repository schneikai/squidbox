import type { AssetQueryScope } from '@/sync/assetSql';

/** An asset query's scope by id: `{ albumId }`, `{ postId }`, `{ assetId }` or `{ contactId }`. */
export type IdScope = Exclude<AssetQueryScope, string>;

type KeyOf<Scope> = Scope extends IdScope ? keyof Scope : never;

/**
 * Each id scope's kind in the asset screen's `scope` URL param, by its key (`satisfies` keeps it
 * whole): the one map assetScopeToParam and assetScopeFromParam read.
 */
const ASSET_SCOPE_KINDS = {
  albumId: 'album',
  postId: 'post',
  assetId: 'asset',
  contactId: 'contact',
} as const satisfies Record<KeyOf<IdScope>, string>;

export default ASSET_SCOPE_KINDS;
