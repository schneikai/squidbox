/* eslint-disable @typescript-eslint/no-explicit-any */
// Generic legacy↔modern base-field adapter for collections without domain-specific quirks
// (albums, posts): maps the legacy `isDeleted` boolean to the modern `deletedAt` tombstone.
// Assets use their own richer adapter (mediaType, syncError) in legacyAsset.ts.
export function toModernRecord(input: Record<string, any>): Record<string, any> {
  const now = Date.now();
  const { isDeleted, ...rest } = input;
  const deletedAt = input.deletedAt !== undefined ? input.deletedAt : isDeleted ? (input.updatedAt ?? now) : null;
  return { ...rest, deletedAt };
}

export function toModernChanges(changes: Record<string, any>): Record<string, any> {
  if ('isDeleted' in changes) {
    const { isDeleted, ...rest } = changes;
    return { ...rest, deletedAt: isDeleted ? Date.now() : null };
  }
  return changes;
}
