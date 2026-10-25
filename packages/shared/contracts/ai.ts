// AI wire contract: the model catalog the server reads from Venice and the blind compare of
// models (Settings → Assistant → Testing, test builds only). The server holds the Venice key; the
// app only ever talks to these endpoints.
import { z } from 'zod';

export const aiModelKindSchema = z.enum(['writing', 'vision']);
export type AiModelKind = z.infer<typeof aiModelKindSchema>;

// One model of Venice's live catalog, as the app shows it. The costs are estimates in US dollars
// (apps/server/src/ai/catalog.ts says what they assume); a model that can't see photos has none
// per 100 photos.
export const apiAiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  supportsVision: z.boolean(),
  isUncensored: z.boolean(),
  costPerReplyUsd: z.number(),
  costPer100PhotosUsd: z.number().nullable(),
});
export type ApiAiModel = z.infer<typeof apiAiModelSchema>;

// GET /ai/models
export const aiModelsResponseSchema = z.object({ models: z.array(apiAiModelSchema) });
export type AiModelsResponse = z.infer<typeof aiModelsResponseSchema>;

export const COMPARE_MIN_MODELS = 2;
export const COMPARE_MAX_MODELS = 4;
export const WRITING_TWEET_COUNT = 3;
export const VISION_TAG_COUNT = 8;
// Photos in one vision compare: each is a request, so two rounds in a minute stay well within the
// vision route's rate limit (240 a minute).
export const VISION_COMPARE_MAX_PHOTOS = 50;
// A 512 px JPEG thumbnail is ~50–100 KB; the web preview may send the 1000 px one unresized.
export const VISION_IMAGE_MAX_BASE64_LENGTH = 1_500_000;

// Each model once: every id is a paid call.
const modelIdsSchema = z
  .array(z.string().min(1))
  .min(COMPARE_MIN_MODELS)
  .max(COMPARE_MAX_MODELS)
  .refine((ids) => new Set(ids).size === ids.length, 'Each model can be compared only once');

// A model's failure is its own result, so one failing model leaves the others' results.
const modelErrorSchema = z.object({ modelId: z.string(), error: z.string() });

// POST /ai/compare/writing — one prompt, each model writes WRITING_TWEET_COUNT tweets. The
// request has room for the user's persona later; the server adds it, the app doesn't send it.
export const compareWritingRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  modelIds: modelIdsSchema,
});
export type CompareWritingRequest = z.infer<typeof compareWritingRequestSchema>;

export const writingResultSchema = z.union([
  z.object({ modelId: z.string(), tweets: z.array(z.string()) }),
  modelErrorSchema,
]);
export type WritingResult = z.infer<typeof writingResultSchema>;

export const compareWritingResponseSchema = z.object({ results: z.array(writingResultSchema) });
export type CompareWritingResponse = z.infer<typeof compareWritingResponseSchema>;

// POST /ai/compare/vision — one photo, each model tags it with VISION_TAG_COUNT tags.
export const compareVisionRequestSchema = z.object({
  image: z.object({
    base64: z.string().min(1).max(VISION_IMAGE_MAX_BASE64_LENGTH),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }),
  modelIds: modelIdsSchema,
});
export type CompareVisionRequest = z.infer<typeof compareVisionRequestSchema>;

export const visionResultSchema = z.union([
  z.object({ modelId: z.string(), tags: z.array(z.string()) }),
  modelErrorSchema,
]);
export type VisionResult = z.infer<typeof visionResultSchema>;

export const compareVisionResponseSchema = z.object({ results: z.array(visionResultSchema) });
export type CompareVisionResponse = z.infer<typeof compareVisionResponseSchema>;
