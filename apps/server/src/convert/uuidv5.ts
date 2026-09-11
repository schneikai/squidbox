import { createHash } from 'node:crypto';

// Deterministic RFC-4122 v5 UUID (SHA-1, namespaced). Used by the legacy importer to turn each
// opaque legacy id (nanoid / undashed-hex) into a canonical uuid *deterministically*: the same
// old id always yields the same uuid, so the import is idempotent and every reference remaps in
// lockstep. No external dependency — Node's crypto has SHA-1.

// Fixed namespace for the Squidbox legacy import (any constant uuid works as a v5 namespace).
export const LEGACY_NAMESPACE = 'b6e7c1a2-9f3d-4c8e-8a1b-2d4f6e8a0c11';

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

function bytesToUuid(b: Buffer): string {
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function uuidv5(name: string, namespace = LEGACY_NAMESPACE): string {
  const hash = createHash('sha1')
    .update(uuidToBytes(namespace))
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC-4122 variant
  return bytesToUuid(bytes);
}
