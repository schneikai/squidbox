/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic legacy↔modern base-field adapter for collections without domain-specific quirks
// (albums, posts): maps the legacy `isDeleted` boolean to the modern `deletedAt` tombstone.
// Assets use their own richer adapter (mediaType, syncError) in legacyAsset.ts.
// Membership arrays (`assets`, `assetRefs`) are not columns — they live in the album_assets /
// post_assets edge collections. Strip them so a legacy-shaped write can't try to insert them.
function stripMembership({ assets, assetRefs, ...rest }: Record<string, any>) {
  return rest;
}

export function toModernRecord(input: Record<string, any>): Record<string, any> {
  const now = Date.now();
  const { isDeleted, ...rest } = stripMembership(input);
  const deletedAt = input.deletedAt !== undefined ? input.deletedAt : isDeleted ? (input.updatedAt ?? now) : null;
  return { ...rest, deletedAt };
}

export function toModernChanges(changes: Record<string, any>): Record<string, any> {
  const stripped = stripMembership(changes);
  if ('isDeleted' in stripped) {
    const { isDeleted, ...rest } = stripped;
    return { ...rest, deletedAt: isDeleted ? Date.now() : null };
  }
  return stripped;
}
