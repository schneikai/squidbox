/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic legacy↔modern base-field adapter for collections without domain-specific quirks
// (albums, posts): maps the legacy `isDeleted` boolean to the modern `deletedAt` tombstone.
// Assets use their own richer adapter (mediaType, syncError) in legacyAsset.ts.
// Membership arrays (`assets`, `assetRefs`) and the derived `postHistory`/`lastPostedAt` are no
// longer columns — they live in the album_assets/post_assets edge collections and derive.ts.
// Strip them so a stray legacy-shaped write can't try to insert a non-existent column.
function stripDerived({ assets, assetRefs, postHistory, lastPostedAt, ...rest }: Record<string, any>) {
  return rest;
}

export function toModernRecord(input: Record<string, any>): Record<string, any> {
  const now = Date.now();
  const { isDeleted, ...rest } = stripDerived(input);
  const deletedAt = input.deletedAt !== undefined ? input.deletedAt : isDeleted ? (input.updatedAt ?? now) : null;
  return { ...rest, deletedAt };
}

export function toModernChanges(changes: Record<string, any>): Record<string, any> {
  const stripped = stripDerived(changes);
  if ('isDeleted' in stripped) {
    const { isDeleted, ...rest } = stripped;
    return { ...rest, deletedAt: isDeleted ? Date.now() : null };
  }
  return stripped;
}
