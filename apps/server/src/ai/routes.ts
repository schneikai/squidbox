import type { FastifyInstance, FastifyReply } from 'fastify';
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
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { authenticate, requireFeature, requireUser } from '../auth/authenticate.js';
import { fetchBalanceAsync } from './balance.js';
import { findModel, getCatalogAsync, type Catalog, type CatalogEntry } from './catalog.js';
import { compareModels, visionTask, writingTask } from './compare.js';
import { readInstructions } from './instructions.js';
import { readFavorites, readPersona } from './persona.js';
import { visionMessages, writingMessages } from './prompts.js';
import { VeniceError } from './venice.js';
import { loadConfig } from '../config.js';

// Aborted once the app stops waiting (a closed compare), so the Venice calls stop too.
function untilClientLeaves(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}

// A body holds one photo's base64 (VISION_IMAGE_MAX_BASE64_LENGTH) and the model ids.
const VISION_REQUEST_BODY_LIMIT = 2 * 1024 * 1024;

// Before any Venice call: 503 ai_not_configured when the server has no Venice key.
async function aiConfigured(): Promise<void> {
  if (!loadConfig().VENICE_API_KEY) throw AppError.aiNotConfigured();
}

// A read from Venice the route can't answer without: 502 ai_unavailable when it fails.
async function orAiUnavailable<T>(promise: Promise<T>, message: string): Promise<T> {
  try {
    return await promise;
  } catch {
    throw AppError.aiUnavailable(message);
  }
}

function catalogAsync(): Promise<Catalog> {
  return orAiUnavailable(getCatalogAsync(), "Couldn't load the models from Venice");
}

type CompareResult<T> = (T & { modelId: string }) | { modelId: string; error: string };

/**
 * Runs `compare` on the requested models it can use, and gives each one it can't (Venice dropped
 * it since the app's list, or it can't see photos) that as its own result, in the request's order.
 */
async function compareRequested<T>(
  ids: string[],
  kind: AiModelKind,
  compare: (models: CatalogEntry[]) => Promise<CompareResult<T>[]>,
): Promise<CompareResult<T>[]> {
  const { entries } = await catalogAsync();
  const found = ids.map((id) => findModel(entries, id, kind));
  const usable = found.flatMap((each) => ('entry' in each ? [each.entry] : []));
  const byId = new Map((usable.length > 0 ? await compare(usable) : []).map((result) => [result.modelId, result]));
  return found.map((each, index) =>
    'entry' in each ? byId.get(each.entry.id)! : { modelId: ids[index]!, error: each.error },
  );
}

// Every route here is behind authenticate, a Venice key and the `ai` feature (403 ai_not_allowed),
// so a new one can't skip the gate.
export async function aiRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (ai) => {
    ai.addHook('preHandler', authenticate());
    ai.addHook('preHandler', aiConfigured);
    ai.addHook('preHandler', requireFeature('ai', AppError.aiNotAllowed));
    const r = ai.withTypeProvider<ZodTypeProvider>();

    // GET /ai/models — every model Venice offers now.
    r.route({
      method: 'GET',
      url: '/ai/models',
      schema: { response: { 200: aiModelsResponseSchema } },
      handler: async () => {
        const { models } = await catalogAsync();
        return { models };
      },
    });

    // The ai_admin routes (the compares, the Venice balance): 403 ai_admin_not_allowed for an
    // account without the `ai_admin` feature, so a new one can't skip that gate either.
    await ai.register(async (admin) => {
      admin.addHook('preHandler', requireFeature('ai_admin', AppError.aiAdminNotAllowed));
      const r = admin.withTypeProvider<ZodTypeProvider>();

      // GET /ai/balance — what is left on the Venice account.
      r.route({
        method: 'GET',
        url: '/ai/balance',
        schema: { response: { 200: aiBalanceResponseSchema } },
        handler: () => orAiUnavailable(fetchBalanceAsync(), "Couldn't load the balance from Venice"),
      });

      // POST /ai/compare/writing — each model writes posts for the same prompt, as the user.
      r.route({
        method: 'POST',
        url: '/ai/compare/writing',
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
        schema: { body: compareWritingRequestSchema, response: { 200: compareWritingResponseSchema } },
        handler: async (request, reply) => {
          const signal = untilClientLeaves(reply);
          // The catalog loads meanwhile (compareRequested reads it from the cache then).
          const user = requireUser(request);
          const [persona, favorites, instructions] = await Promise.all([
            readPersona(getDb(), user.id),
            readFavorites(getDb(), user.id),
            readInstructions(getDb(), user),
            catalogAsync(),
          ]);
          const messages = writingMessages({
            prompt: request.body.prompt,
            persona,
            favorites,
            instructions,
          });
          const results = await compareRequested(request.body.modelIds, 'writing', (models) =>
            compareModels({ task: writingTask, messages, models, log: request.log, signal }),
          );
          return { results };
        },
      });

      // POST /ai/compare/vision — each model tags the same photo, guided by the prompt. One request
      // per photo, so a compare of many photos (and a second round within the minute) fits the limit.
      r.route({
        method: 'POST',
        url: '/ai/compare/vision',
        bodyLimit: VISION_REQUEST_BODY_LIMIT,
        config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
        schema: { body: compareVisionRequestSchema, response: { 200: compareVisionResponseSchema } },
        handler: async (request, reply) => {
          const signal = untilClientLeaves(reply);
          const { base64, mimeType } = request.body.image;
          const user = requireUser(request);
          const [persona, instructions] = await Promise.all([
            readPersona(getDb(), user.id),
            readInstructions(getDb(), user),
          ]);
          const messages = visionMessages({
            prompt: request.body.prompt,
            imageDataUrl: `data:${mimeType};base64,${base64}`,
            instructions,
            contentTags: persona?.contentTags ?? [],
          });
          const results = await compareRequested(request.body.modelIds, 'vision', (models) =>
            compareModels({ task: visionTask, messages, models, log: request.log, signal }),
          );
          return { results };
        },
      });
    });
  });
}
