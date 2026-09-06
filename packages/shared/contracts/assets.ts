// Asset-file (S3) wire contract — 2026 rewrite.
//
// Split architecture, chosen deliberately (see apps/mobile/src/obsolete-code):
//   • DOWNLOADS are direct-to-S3 via presigned GET URLs (a plain GET streams fine on Expo).
//   • UPLOADS are server-proxied streaming. Direct-to-S3 presigned upload was tried and
//     abandoned: Expo/React Native cannot split large files for client-side S3 multipart, and
//     single-PUT presigned uploads crash on large files (`cloudFileUtils.js`
//     "Upload crashes on large files"; `fileUtils.js` "crashes on files larger than 2GB!").
//     A single S3 PUT is also capped at 5 GB, so anything larger REQUIRES multipart (up to
//     5 TB) — which the client can't orchestrate. So the client streams the whole file as ONE
//     binary PUT and the SERVER splits it into S3 multipart parts (via @aws-sdk/lib-storage).
//     Hence the upload endpoint takes a raw binary body, not JSON — no request schema here.
//
// Keys the client sends are always bare file keys; the server derives the per-user S3
// namespace from the auth token, so a client can never reach another tenant's objects.
import { z } from 'zod';

// Server-side S3 multipart part size (binary/1024-based). lib-storage auto-multiparts the
// incoming stream using this part size; small files become a single part automatically.
export const MULTIPART_PART_SIZE = 100 * 1024 * 1024; // 104,857,600 bytes (100 MiB)

// Presign expiry: default 1h; clamp any positive request to <= 1 week.
export const PRESIGN_DEFAULT_EXPIRES_IN = 3600;
export const PRESIGN_MAX_EXPIRES_IN = 604800;

export function resolveExpiresIn(requested?: number): number {
  if (typeof requested === 'number' && Number.isFinite(requested) && requested > 0) {
    return Math.min(Math.trunc(requested), PRESIGN_MAX_EXPIRES_IN);
  }
  return PRESIGN_DEFAULT_EXPIRES_IN;
}

// --- Download URLs (presigned GET) ---
export const downloadUrlsRequestSchema = z.object({
  keys: z.array(z.string()).min(1),
  expiresIn: z.number().int().positive().optional(),
});
export type DownloadUrlsRequest = z.infer<typeof downloadUrlsRequestSchema>;

export const presignedUrlSchema = z.object({ key: z.string(), url: z.string().url() });
export const downloadUrlsResponseSchema = z.object({
  urls: z.array(presignedUrlSchema),
});
export type DownloadUrlsResponse = z.infer<typeof downloadUrlsResponseSchema>;

// --- Upload (server-proxied streaming; raw binary body, see header note) ---
// PUT /api/v1/assets/upload/<key>  (key may contain slashes; token via header or ?token=)
export const uploadResponseSchema = z.object({ key: z.string() });
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

// --- Delete (batch) ---
export const deleteAssetsRequestSchema = z.object({
  keys: z.array(z.string()).min(1),
});
export type DeleteAssetsRequest = z.infer<typeof deleteAssetsRequestSchema>;

export const deleteAssetsResponseSchema = z.object({
  deleted: z.array(z.string()),
});
export type DeleteAssetsResponse = z.infer<typeof deleteAssetsResponseSchema>;
