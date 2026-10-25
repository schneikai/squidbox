import type { Readable } from 'node:stream';
import { S3Client, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { DELETE_KEYS_MAX, MULTIPART_PART_SIZE } from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';
import { fullKey, type StorageLocation } from './resolver.js';

let client: S3Client | null = null;
let presignClient: S3Client | null = null;

function createClient(endpoint: string | undefined): S3Client {
  const cfg = loadConfig();
  return new S3Client({
    region: cfg.AWS_REGION,
    credentials: {
      accessKeyId: cfg.AWS_ACCESS_KEY_ID,
      secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY,
    },
    // Local dev: talk to MinIO/LocalStack (path-style). Unset in prod ⇒ real AWS.
    ...(endpoint ? { endpoint, forcePathStyle: cfg.S3_FORCE_PATH_STYLE } : {}),
  });
}

function s3(): S3Client {
  client ??= createClient(loadConfig().S3_ENDPOINT);
  return client;
}

// Presigned URLs embed the endpoint host, so they are signed for the address the app will call.
function s3Presign(): S3Client {
  const cfg = loadConfig();
  presignClient ??= createClient(cfg.S3_PUBLIC_ENDPOINT ?? cfg.S3_ENDPOINT);
  return presignClient;
}

export function presignedDownloadUrl(loc: StorageLocation, fileKey: string, expiresIn: number): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: loc.bucket, Key: fullKey(loc, fileKey) });
  return getSignedUrl(s3Presign(), cmd, { expiresIn });
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
  contentType?: string,
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

// One request per DELETE_KEYS_MAX keys (the S3 limit). Resolves to the keys S3 reported an error for;
// a key that doesn't exist counts as deleted. A failed request, or an invalid key, throws.
export async function deleteObjects(loc: StorageLocation, fileKeys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (let i = 0; i < fileKeys.length; i += DELETE_KEYS_MAX) {
    const byFullKey = new Map(fileKeys.slice(i, i + DELETE_KEYS_MAX).map((key) => [fullKey(loc, key), key]));
    const Objects = [...byFullKey.keys()].map((Key) => ({ Key }));
    const res = await s3()
      .send(new DeleteObjectsCommand({ Bucket: loc.bucket, Delete: { Objects, Quiet: true } }))
      .catch((err) => {
        throw AppError.s3(err instanceof Error ? err.message : 'Delete failed');
      });
    for (const error of res.Errors ?? []) failed.push(byFullKey.get(error.Key ?? '') ?? String(error.Key));
  }
  return failed;
}
