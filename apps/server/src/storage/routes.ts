import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  downloadUrlsRequestSchema,
  downloadUrlsResponseSchema,
  deleteAssetsRequestSchema,
  deleteAssetsResponseSchema,
  resolveExpiresIn,
} from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { authenticate, requireUser } from '../auth/authenticate.js';
import { resolveStorage, type StorageLocation } from './resolver.js';
import { isPurgedFileKey } from '../sync/purgedFiles.js';
import { isLibraryCopy, liveDownloadUrls, readOnlyLibraryError } from '../dev/libraryCopy.js';
import { presignedDownloadUrl, uploadStream, deleteObjects } from './s3.js';

function storageFor(request: FastifyRequest): StorageLocation {
  return resolveStorage(requireUser(request), loadConfig().S3_SHARED_BUCKET);
}

function purgedError(): AppError {
  return new AppError(410, 'purged', 'The asset was deleted permanently');
}

// Simple per-user upload concurrency guard so one tenant's bulk upload can't starve others.
const MAX_CONCURRENT_UPLOADS_PER_USER = 4;
const inFlight = new Map<string, number>();

function acquireUploadSlot(userId: string): void {
  const n = inFlight.get(userId) ?? 0;
  if (n >= MAX_CONCURRENT_UPLOADS_PER_USER) {
    throw new AppError(429, 'rate_limited', 'Too many concurrent uploads');
  }
  inFlight.set(userId, n + 1);
}
function releaseUploadSlot(userId: string): void {
  const n = inFlight.get(userId) ?? 1;
  if (n <= 1) inFlight.delete(userId);
  else inFlight.set(userId, n - 1);
}

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // POST /assets/download-urls — presigned GET URLs (direct-to-S3 download).
  r.route({
    method: 'POST',
    url: '/assets/download-urls',
    preHandler: authenticate(),
    schema: { body: downloadUrlsRequestSchema, response: { 200: downloadUrlsResponseSchema } },
    handler: async (request) => {
      const expiresIn = resolveExpiresIn(request.body.expiresIn);
      if (isLibraryCopy(requireUser(request))) return liveDownloadUrls(request.body.keys, expiresIn);
      const loc = storageFor(request);
      const urls = await Promise.all(
        request.body.keys.map(async (key) => ({
          key,
          url: await presignedDownloadUrl(loc, key, expiresIn),
        })),
      );
      return { urls };
    },
  });

  // PUT /assets/upload/*  — server-proxied streaming upload (server does S3 multipart).
  // Raw binary body (no JSON schema). Token via Bearer OR ?token= (iOS background-upload).
  // Registered in its own scope whose only body parser passes the stream through untouched, so no
  // built-in parser (JSON, text) can consume an upload before it reaches S3.
  await app.register(async (uploads) => {
    uploads.removeAllContentTypeParsers();
    uploads.addContentTypeParser('*', (_request, payload, done) => done(null, payload));

    uploads.route({
      method: 'PUT',
      url: '/assets/upload/*',
      preHandler: authenticate({ allowQueryToken: true }),
      handler: async (request, reply) => {
        const user = requireUser(request);
        if (isLibraryCopy(user)) throw readOnlyLibraryError();
        const userId = user.id;
        const fileKey = (request.params as Record<string, string>)['*'];
        if (!fileKey) throw new AppError(400, 'validation_error', 'Missing file key');
        const loc = storageFor(request);
        const contentType = request.headers['content-type'];
        // A purged asset's file is refused before its body is read, and deleted again when the purge
        // landed during the upload (sync-design §7a).
        if (await isPurgedFileKey(getDb(), userId, fileKey)) throw purgedError();

        acquireUploadSlot(userId);
        try {
          await uploadStream(loc, fileKey, request.raw, contentType);
        } finally {
          releaseUploadSlot(userId);
        }
        if (await isPurgedFileKey(getDb(), userId, fileKey)) {
          const [failed] = await deleteObjects(loc, [fileKey]);
          if (failed) throw AppError.s3(`Delete failed: ${failed}`);
          throw purgedError();
        }
        return reply.code(200).send({ key: fileKey });
      },
    });
  });

  // POST /assets/delete — batch delete.
  r.route({
    method: 'POST',
    url: '/assets/delete',
    preHandler: authenticate(),
    schema: { body: deleteAssetsRequestSchema, response: { 200: deleteAssetsResponseSchema } },
    handler: async (request) => {
      const [failed] = await deleteObjects(storageFor(request), request.body.keys);
      if (failed) throw AppError.s3(`Delete failed: ${failed}`);
      return { deleted: request.body.keys };
    },
  });
}
