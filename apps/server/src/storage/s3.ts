import type { Readable } from 'node:stream';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { MULTIPART_PART_SIZE } from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';
import { fullKey, type StorageLocation } from './resolver.js';

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    const cfg = loadConfig();
    client = new S3Client({
      region: cfg.AWS_REGION,
      credentials: {
        accessKeyId: cfg.AWS_ACCESS_KEY_ID,
        secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY,
      },
      // Local dev: talk to MinIO/LocalStack (path-style). Unset in prod ⇒ real AWS.
      ...(cfg.S3_ENDPOINT ? { endpoint: cfg.S3_ENDPOINT, forcePathStyle: cfg.S3_FORCE_PATH_STYLE } : {}),
    });
  }
  return client;
}

export function presignedDownloadUrl(
  loc: StorageLocation,
  fileKey: string,
  expiresIn: number
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: loc.bucket, Key: fullKey(loc, fileKey) });
  return getSignedUrl(s3(), cmd, { expiresIn });
}

/**
 * Stream an upload straight through to S3. lib-storage's Upload auto-multiparts the incoming
 * stream using MULTIPART_PART_SIZE (small files become a single part), so we never buffer the
 * whole file and can handle objects far larger than the 5 GB single-PUT limit. This is the
 * server's job precisely because the Expo client can't split large files (see the contract
 * note in @squidbox/shared assets.ts).
 */
export async function uploadStream(
  loc: StorageLocation,
  fileKey: string,
  body: Readable,
  contentType?: string
): Promise<void> {
  const upload = new Upload({
    client: s3(),
    params: {
      Bucket: loc.bucket,
      Key: fullKey(loc, fileKey),
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    },
    partSize: MULTIPART_PART_SIZE,
    queueSize: 2, // bound memory: at most ~2 parts in flight per upload
  });
  try {
    await upload.done(); // aborts the multipart upload automatically on error
  } catch (err) {
    throw AppError.s3(err instanceof Error ? err.message : 'Upload failed');
  }
}

// Download an object's contents as a UTF-8 string (used by the legacy converter to read the
// JSON backups). Returns null if the object doesn't exist.
export async function getObjectText(loc: StorageLocation, fileKey: string): Promise<string | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: loc.bucket, Key: fullKey(loc, fileKey) }));
    return (await res.Body?.transformToString()) ?? null;
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && (err.name === 'NoSuchKey' || err.name === 'NotFound')) {
      return null;
    }
    throw AppError.s3(err instanceof Error ? err.message : 'Get failed');
  }
}

export async function deleteObject(loc: StorageLocation, fileKey: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: loc.bucket, Key: fullKey(loc, fileKey) }));
  } catch (err) {
    throw AppError.s3(err instanceof Error ? err.message : 'Delete failed');
  }
}

export async function headObject(
  loc: StorageLocation,
  fileKey: string
): Promise<{ exists: boolean; contentLength?: number; etag?: string }> {
  try {
    const res = await s3().send(
      new HeadObjectCommand({ Bucket: loc.bucket, Key: fullKey(loc, fileKey) })
    );
    return { exists: true, contentLength: res.ContentLength, etag: res.ETag };
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'NotFound') {
      return { exists: false };
    }
    throw AppError.s3(err instanceof Error ? err.message : 'Head failed');
  }
}

// copy+delete; CopySource must be URI-encoded for aws-sdk v3 or keys with special chars fail.
export async function moveObject(loc: StorageLocation, fromKey: string, toKey: string): Promise<void> {
  const from = fullKey(loc, fromKey);
  const to = fullKey(loc, toKey);
  try {
    await s3().send(
      new CopyObjectCommand({
        Bucket: loc.bucket,
        CopySource: encodeURIComponent(`${loc.bucket}/${from}`),
        Key: to,
      })
    );
    await s3().send(new DeleteObjectCommand({ Bucket: loc.bucket, Key: from }));
  } catch (err) {
    throw AppError.s3(err instanceof Error ? err.message : 'Move failed');
  }
}
