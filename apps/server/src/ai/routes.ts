import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  aiModelsResponseSchema,
  compareVisionRequestSchema,
  compareVisionResponseSchema,
  compareWritingRequestSchema,
  compareWritingResponseSchema,
  VISION_REQUEST_BODY_LIMIT,
  type AiModelKind,
} from '@squidbox/shared';
import { loadConfig } from '../config.js';
import { AppError } from '../errors.js';
import { authenticate } from '../auth/authenticate.js';
import { findModel, getCatalogAsync, toApiModel, type CatalogEntry, type VeniceAccess } from './catalog.js';
import { compareVision, compareWriting } from './compare.js';

// The Venice key and address, or 503 before any call when the server has no key.
function veniceAccess(): VeniceAccess {
  const { VENICE_API_KEY: apiKey, VENICE_BASE_URL: baseUrl } = loadConfig();
  if (!apiKey) throw AppError.aiNotConfigured();
  return { baseUrl, apiKey };
}

async function catalogFor(access: VeniceAccess): Promise<CatalogEntry[]> {
  try {
    return await getCatalogAsync(access);
  } catch {
    throw AppError.aiUnavailable("Couldn't load the models from Venice");
  }
}

// The catalog entries of the requested models, in the request's order; 400 for any it can't use.
async function resolveModels(access: VeniceAccess, ids: string[], kind: AiModelKind): Promise<CatalogEntry[]> {
  const catalog = await catalogFor(access);
  return ids.map((id) => {
    const found = findModel(catalog, id, kind);
    if ('error' in found) throw new AppError(400, 'validation_error', found.error);
    return found.entry;
  });
}

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  const r = app.withTypeProvider<ZodTypeProvider>();

  // GET /ai/models — every model Venice offers now.
  r.route({
    method: 'GET',
    url: '/ai/models',
    preHandler: authenticate(),
    schema: { response: { 200: aiModelsResponseSchema } },
    handler: async () => {
      const catalog = await catalogFor(veniceAccess());
      return { models: catalog.map(toApiModel) };
    },
  });

  // POST /ai/compare/writing — each model writes tweets for the same prompt.
  r.route({
    method: 'POST',
    url: '/ai/compare/writing',
    preHandler: authenticate(),
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { body: compareWritingRequestSchema, response: { 200: compareWritingResponseSchema } },
    handler: async (request) => {
      const access = veniceAccess();
      const models = await resolveModels(access, request.body.modelIds, 'writing');
      const results = await compareWriting({ ...access, prompt: request.body.prompt, models, log: request.log });
      return { results };
    },
  });

  // POST /ai/compare/vision — each model tags the same photo. One request per photo, so a compare
  // of many photos (and a second round within the minute) fits the limit.
  r.route({
    method: 'POST',
    url: '/ai/compare/vision',
    preHandler: authenticate(),
    bodyLimit: VISION_REQUEST_BODY_LIMIT,
    config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    schema: { body: compareVisionRequestSchema, response: { 200: compareVisionResponseSchema } },
    handler: async (request) => {
      const access = veniceAccess();
      const models = await resolveModels(access, request.body.modelIds, 'vision');
      const { base64, mimeType } = request.body.image;
      const imageDataUrl = `data:${mimeType};base64,${base64}`;
      const results = await compareVision({ ...access, imageDataUrl, models, log: request.log });
      return { results };
    },
  });
}
