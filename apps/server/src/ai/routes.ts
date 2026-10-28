import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  aiBalanceResponseSchema,
  aiModelKindSchema,
  aiModelsResponseSchema,
  chatReplySchema,
  chatRequestSchema,
  compareVisionRequestSchema,
  compareVisionResponseSchema,
  compareWritingRequestSchema,
  compareWritingResponseSchema,
  modelCheckResponseSchema,
  modelDefaultRequestSchema,
  modelDefaultVariantSchema,
  tagPhotoRequestSchema,
  tagPhotoResponseSchema,
  uncensoredRequestSchema,
  verificationRequestSchema,
  type AiModelKind,
  type AiModelsResponse,
} from '@squidbox/shared';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import { AppError } from '../errors.js';
import { authenticate, requireFeature, requireUser } from '../auth/authenticate.js';
import { fetchBalanceAsync } from './balance.js';
import { catalogAsync, findModel, toApiModel, type CatalogEntry } from './catalog.js';
import { chatAsync } from './chat.js';
import { compareModels } from './compare.js';
import { readInstructions } from './instructions.js';
import { readLatestCheck, runCheck, startCheck } from './modelChecks.js';
import { readFavorites, readPersona } from './persona.js';
import { visionMessages, writingMessages } from './prompts.js';
import { tagPhotoAsync } from './tagging.js';
import { visionTask, writingTask } from './tasks.js';
import { orAiUnavailable, VeniceError } from './venice.js';
import { readVerification, setModelDefault, setUncensored, setVerification } from './verification.js';
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

// The catalog as every account gets it: Venice's models with the marks, and the defaults.
async function aiModelsAsync(): Promise<AiModelsResponse> {
  const [{ entries }, verification] = await Promise.all([catalogAsync(), readVerification(getDb())]);
  return { models: entries.map((entry) => toApiModel(entry, verification)), defaults: verification.defaults };
}

// The model of a kind for a check or a mark: 502 ai_unavailable when Venice no longer offers it or it
// can't do the kind.
async function catalogModel(
  modelId: string,
  kind: AiModelKind,
): Promise<{ entry: CatalogEntry; entries: CatalogEntry[] }> {
  const { entries } = await catalogAsync();
  const found = findModel(entries, modelId, kind);
  if ('error' in found) throw AppError.aiUnavailable(found.error);
  return { entry: found.entry, entries };
}

const modelParams = z.object({ kind: aiModelKindSchema, modelId: z.string().min(1) });

// Every route here is behind authenticate, a Venice key and the `ai` feature (403 ai_not_allowed),
// so a new one can't skip the gate.
export async function aiRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (ai) => {
    ai.addHook('preHandler', authenticate());
    ai.addHook('preHandler', aiConfigured);
    ai.addHook('preHandler', requireFeature('ai', AppError.aiNotAllowed));
    const r = ai.withTypeProvider<ZodTypeProvider>();

    // GET /ai/models — every model Venice offers now, with Squidbox's marks, and the defaults.
    r.route({
      method: 'GET',
      url: '/ai/models',
      schema: { response: { 200: aiModelsResponseSchema } },
      handler: aiModelsAsync,
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

    // The ai_admin routes (the compares, the Venice balance, the model checks and marks): 403 ai_admin_not_allowed for an
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

      // GET /ai/checks/:kind/:modelId — the model's latest check of the kind (null before its first).
      r.route({
        method: 'GET',
        url: '/ai/checks/:kind/:modelId',
        schema: { params: modelParams, response: { 200: modelCheckResponseSchema } },
        handler: async (request) => ({
          check: await readLatestCheck(getDb(), request.params.kind, request.params.modelId),
        }),
      });

      // POST /ai/checks/:kind/:modelId — starts the model's check of the kind, unless one is running,
      // and answers the running check at once: the run goes on in the background (modelChecks.ts), with
      // the admin's own instructions (an edited judge or Photo tags text is what runs).
      r.route({
        method: 'POST',
        url: '/ai/checks/:kind/:modelId',
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: { params: modelParams, response: { 200: modelCheckResponseSchema } },
        handler: async (request) => {
          const { kind, modelId } = request.params;
          const user = requireUser(request);
          const db = getDb();
          const { entry, entries } = await catalogModel(modelId, kind);
          const { check, isNew } = await startCheck(db, { kind, modelId, userId: user.id });
          if (isNew) {
            const instructionsAsync = () => readInstructions(db, user);
            void runCheck(db, { check, model: entry, catalog: entries, instructionsAsync, log: request.log });
          }
          return { check };
        },
      });

      // PUT /ai/verification/:kind/:modelId — marks the model verified for the kind or not; answers the
      // catalog with the new marks. Unmarking needs no catalog, so a model Venice dropped can still be
      // unmarked.
      r.route({
        method: 'PUT',
        url: '/ai/verification/:kind/:modelId',
        schema: { params: modelParams, body: verificationRequestSchema, response: { 200: aiModelsResponseSchema } },
        handler: async (request) => {
          const { kind, modelId } = request.params;
          const { isVerified } = request.body;
          if (isVerified) await catalogModel(modelId, kind);
          await setVerification(getDb(), { kind, modelId, isVerified, userId: requireUser(request).id });
          return aiModelsAsync();
        },
      });

      // PUT /ai/uncensored/:modelId — the model's override of Venice's Uncensored label, whatever the
      // kind (null follows Venice); answers the catalog with the new marks. Clearing it needs no model
      // in the catalog, so an override on a model Venice dropped can still be removed.
      r.route({
        method: 'PUT',
        url: '/ai/uncensored/:modelId',
        schema: {
          params: z.object({ modelId: z.string().min(1) }),
          body: uncensoredRequestSchema,
          response: { 200: aiModelsResponseSchema },
        },
        handler: async (request) => {
          const { modelId } = request.params;
          const { uncensored } = request.body;
          const found = findModel((await catalogAsync()).entries, modelId, null);
          if ('error' in found && uncensored !== null) throw AppError.aiUnavailable(found.error);
          const entry = 'entry' in found ? found.entry : null;
          await setUncensored(getDb(), { modelId, entry, uncensored, userId: requireUser(request).id });
          return aiModelsAsync();
        },
      });

      // PUT /ai/defaults/:kind/:variant — makes the model the kind's default for the variant (regular,
      // or unrestricted for Adult content); answers the catalog with the new defaults.
      r.route({
        method: 'PUT',
        url: '/ai/defaults/:kind/:variant',
        schema: {
          params: z.object({ kind: aiModelKindSchema, variant: modelDefaultVariantSchema }),
          body: modelDefaultRequestSchema,
          response: { 200: aiModelsResponseSchema },
        },
        handler: async (request) => {
          const { kind, variant } = request.params;
          const { entry } = await catalogModel(request.body.modelId, kind);
          await setModelDefault(getDb(), { kind, variant, entry });
          return aiModelsAsync();
        },
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
