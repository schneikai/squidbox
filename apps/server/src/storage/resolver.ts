import { AppError } from '../errors.js';

// Per-user storage location. Every S3 key is built as `keyPrefix + fileKey` from the
// AUTHENTICATED user, so a client can only ever read/write inside its own namespace
// (multi-tenant isolation, sync-design §2a).
export interface StorageLocation {
  bucket: string;
  keyPrefix: string;
}

export interface StorageResolvableUser {
  id: string;
  storageBucket: string | null;
}

/**
 * Resolve where a user's objects live:
 *  - existing account: its legacy per-user bucket, empty prefix (its binaries never move).
 *  - new users (storageBucket = null): the shared multi-tenant bucket + `u/<user_id>/` prefix.
 */
export function resolveStorage(user: StorageResolvableUser, sharedBucket: string): StorageLocation {
  if (user.storageBucket) {
    return { bucket: user.storageBucket, keyPrefix: '' };
  }
  return { bucket: sharedBucket, keyPrefix: `u/${user.id}/` };
}

// Client keys are bare file keys. Reject anything that could try to escape the namespace or
// isn't a plain relative key. (S3 treats keys literally, but keep the contract tight.)
export function fullKey(loc: StorageLocation, fileKey: string): string {
  if (!fileKey || fileKey.startsWith('/') || fileKey.split('/').includes('..')) {
    throw new AppError(400, 'validation_error', `Invalid file key: ${fileKey}`);
  }
  return loc.keyPrefix + fileKey;
}
