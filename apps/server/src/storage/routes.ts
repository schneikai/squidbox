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
import { AppError } from '../errors.js';
import { authenticate, requireUser } from '../auth/authenticate.js';
import { resolveStorage, type StorageLocation } from './resolver.js';
import { presignedDownloadUrl, uploadStream, deleteObject } from './s3.js';

function storageFor(request: FastifyRequest): StorageLocation {
  return resolveStorage(requireUser(request), loadConfig().S3_SHARED_BUCKET);
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
      const loc = storageFor(request);
      const expiresIn = resolveExpiresIn(request.body.expiresIn);
      const urls = await Promise.all(
        request.body.keys.map(async (key) => ({
          key,
          url: await presignedDownloadUrl(loc, key, expiresIn),
        }))
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
        const userId = requireUser(request).id;
        const fileKey = (request.params as Record<string, string>)['*'];
        if (!fileKey) throw new AppError(400, 'validation_error', 'Missing file key');
        const loc = storageFor(request);
        const contentType = request.headers['content-type'];

        acquireUploadSlot(userId);
        try {
          await uploadStream(loc, fileKey, request.raw, contentType);
        } finally {
          releaseUploadSlot(userId);
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
      const loc = storageFor(request);
      await Promise.all(request.body.keys.map((key) => deleteObject(loc, key)));
      return { deleted: request.body.keys };
    },
  });
}
