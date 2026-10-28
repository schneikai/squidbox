import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  aiBalanceResponseSchema,
  aiModelsResponseSchema,
  chatReplySchema,
  chatRequestSchema,
  compareVisionRequestSchema,
  compareVisionResponseSchema,
  compareWritingRequestSchema,
  compareWritingResponseSchema,
  tagPhotoRequestSchema,
  tagPhotoResponseSchema,
  type AiModelKind,
} from '@squidbox/shared';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { authenticate, requireFeature, requireUser } from '../auth/authenticate.js';
import { fetchBalanceAsync } from './balance.js';
import { catalogAsync, findModel, type CatalogEntry } from './catalog.js';
import { chatAsync } from './chat.js';
import { compareModels } from './compare.js';
import { readInstructions } from './instructions.js';
import { readFavorites, readPersona } from './persona.js';
import { visionMessages, writingMessages } from './prompts.js';
import { tagPhotoAsync } from './tagging.js';
import { visionTask, writingTask } from './tasks.js';
import { orAiUnavailable, VeniceError } from './venice.js';
import { loadConfig } from '../config.js';

// Aborted once the app stops waiting (a closed compare), so the Venice calls stop too.
function untilClientLeaves(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.on('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}

// A body holds one photo's base64 (VISION_IMAGE_MAX_BASE64_LENGTH) and, for a compare, the model ids.
const VISION_REQUEST_BODY_LIMIT = 2 * 1024 * 1024;

// Before any Venice call: 503 ai_not_configured when the server has no Venice key.
async function aiConfigured(): Promise<void> {
  if (!loadConfig().VENICE_API_KEY) throw AppError.aiNotConfigured();
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

    // POST /ai/tags — the user's vision model tags one photo, as their Photo tags instructions say;
    // the app stores the tags on the asset (Tag it / Tag again in its details). Every request is a
    // paid Venice call, so the limit is lower than the compares' per-photo one.
    r.route({
      method: 'POST',
      url: '/ai/tags',
      bodyLimit: VISION_REQUEST_BODY_LIMIT,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { body: tagPhotoRequestSchema, response: { 200: tagPhotoResponseSchema } },
      handler: async (request, reply) => {
        const signal = untilClientLeaves(reply);
        const tags = await tagPhotoAsync({
          db: getDb(),
          user: requireUser(request),
          image: request.body.image,
          signal,
        });
        return { tags };
      },
    });

    // POST /ai/chat — the assistant chat: the user's writing model answers the transcript, with post
    // options when asked, about the chat's post (Write with AI in the post editor). Nothing is stored.
    r.route({
      method: 'POST',
      url: '/ai/chat',
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: { body: chatRequestSchema, response: { 200: chatReplySchema } },
      handler: async (request, reply) => {
        const signal = untilClientLeaves(reply);
        return chatAsync({ db: getDb(), user: requireUser(request), request: request.body, signal });
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
          // A model's posts are its reply's options.
          return {
            results: results.map((result) =>
              'error' in result ? result : { modelId: result.modelId, tweets: result.postOptions },
            ),
          };
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
          const persona = await readPersona(getDb(), user.id);
          const messages = visionMessages({
            prompt: request.body.prompt,
            imageDataUrl: `data:${mimeType};base64,${base64}`,
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
