/** An asset query's id scope (assetQuery's `{ albumId }`, …) by its kind in the asset screen's URL. */
const assetScopeKinds = { album: 'albumId', post: 'postId', asset: 'assetId', contact: 'contactId' } as const;

export type AssetScopeKind = keyof typeof assetScopeKinds;
export type AssetScopeKey = (typeof assetScopeKinds)[AssetScopeKind];

export default assetScopeKinds;
