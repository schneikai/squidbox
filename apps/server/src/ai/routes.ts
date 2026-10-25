import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  aiBalanceResponseSchema,
  aiModelsResponseSchema,
  compareVisionRequestSchema,
  compareVisionResponseSchema,
  compareWritingRequestSchema,
  compareWritingResponseSchema,
  type AiModelKind,
} from '@squidbox/shared';
import { AppError } from '../errors.js';
import { authenticate, requireUser } from '../auth/authenticate.js';
import { fetchBalanceAsync } from './balance.js';
import { findModel, getCatalogAsync, type Catalog, type CatalogEntry } from './catalog.js';
import { compareModels, visionTask, writingTask } from './compare.js';
import { visionMessages, writingMessages } from './prompts.js';
import { requireVenice } from './venice.js';

// A body holds one photo's base64 (VISION_IMAGE_MAX_BASE64_LENGTH) and the model ids.
const VISION_REQUEST_BODY_LIMIT = 2 * 1024 * 1024;

// After authenticate: the account may use AI and the server has a key, before any Venice call.
async function aiAccess(request: FastifyRequest): Promise<void> {
  requireVenice(requireUser(request).email);
}

async function catalogAsync(): Promise<Catalog> {
  try {
    return await getCatalogAsync();
  } catch {
    throw AppError.aiUnavailable("Couldn't load the models from Venice");
  }
}

// The catalog entries of the requested models, in the request's order; 400 for any it can't use.
async function resolveModels(ids: string[], kind: AiModelKind): Promise<CatalogEntry[]> {
  const { entries } = await catalogAsync();
  return ids.map((id) => {
    const found = findModel(entries, id, kind);
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
    preHandler: [authenticate(), aiAccess],
    schema: { response: { 200: aiModelsResponseSchema } },
    handler: async () => {
      const { models } = await catalogAsync();
      return { models };
    },
  });

  // GET /ai/balance — what is left on the Venice account.
  r.route({
    method: 'GET',
    url: '/ai/balance',
    preHandler: [authenticate(), aiAccess],
    schema: { response: { 200: aiBalanceResponseSchema } },
    handler: async () => {
      try {
        return await fetchBalanceAsync();
      } catch {
        throw AppError.aiUnavailable("Couldn't load the balance from Venice");
      }
    },
  });

  // POST /ai/compare/writing — each model writes tweets for the same prompt.
  r.route({
    method: 'POST',
    url: '/ai/compare/writing',
    preHandler: [authenticate(), aiAccess],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    schema: { body: compareWritingRequestSchema, response: { 200: compareWritingResponseSchema } },
    handler: async (request) => {
      const models = await resolveModels(request.body.modelIds, 'writing');
      // persona: the user's About you / Tone once that setup exists (prompts.ts).
      const messages = writingMessages({ prompt: request.body.prompt, persona: null });
      const results = await compareModels({ task: writingTask, messages, models, log: request.log });
      return { results };
    },
  });

  // POST /ai/compare/vision — each model tags the same photo, guided by the prompt. One request per photo, so a compare
  // of many photos (and a second round within the minute) fits the limit.
  r.route({
    method: 'POST',
    url: '/ai/compare/vision',
    preHandler: [authenticate(), aiAccess],
    bodyLimit: VISION_REQUEST_BODY_LIMIT,
    config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    schema: { body: compareVisionRequestSchema, response: { 200: compareVisionResponseSchema } },
    handler: async (request) => {
      const models = await resolveModels(request.body.modelIds, 'vision');
      const { base64, mimeType } = request.body.image;
      const messages = visionMessages({
        prompt: request.body.prompt,
        imageDataUrl: `data:${mimeType};base64,${base64}`,
      });
      const results = await compareModels({ task: visionTask, messages, models, log: request.log });
      return { results };
    },
  });
}
