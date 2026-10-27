// AI wire contract: the model catalog the server reads from Venice and the blind compare of
// models (Settings → Assistant → Testing, test builds only). The server holds the Venice key; the
// app only ever talks to these endpoints.
import { z } from 'zod';
import { ASSET_TAG_LIMITS, assetTagSchema } from '../collections/asset';

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

// GET /ai/balance — what is left on the Venice account the server's key belongs to: US dollars
// and DIEM (Venice's daily allowance for staked VVV; it resets each day at nextResetAt).
export const aiBalanceResponseSchema = z.object({
  usd: z.number(),
  diem: z.number(),
  nextResetAt: z.string().nullable(),
});
export type AiBalanceResponse = z.infer<typeof aiBalanceResponseSchema>;

export const COMPARE_MIN_MODELS = 2;
export const COMPARE_PROMPT_MAX_LENGTH = 2000;
export const WRITING_TWEET_COUNT = 3;
// Photos in one vision compare: each is a request, so two rounds in a minute stay well within the
// vision route's rate limit (240 a minute).
export const VISION_COMPARE_MAX_PHOTOS = 50;
// The app sends a 512 px JPEG (readVisionImageAsync); the limit still takes the 1000 px thumbnail
// (~150–400 KB, ~0.5 MB as base64) that older apps send.
export const VISION_IMAGE_MAX_BASE64_LENGTH = 1_500_000;

// One photo as the app sends it.
const visionImageSchema = z.object({
  base64: z.string().min(1).max(VISION_IMAGE_MAX_BASE64_LENGTH),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

// Each model once: every id is a paid call.
const modelIdsSchema = z
  .array(z.string().min(1))
  .min(COMPARE_MIN_MODELS)
  .refine((ids) => new Set(ids).size === ids.length, 'Each model can be compared only once');

// The prompt of a compare: what to write, or what to look for in the photos.
const promptSchema = z.string().trim().min(1).max(COMPARE_PROMPT_MAX_LENGTH);

// A model's failure is its own result, so one failing model leaves the others' results.
const modelErrorSchema = z.object({ modelId: z.string(), error: z.string() });

// POST /ai/compare/writing — one prompt, each model writes WRITING_TWEET_COUNT tweets. The
// request has room for the user's persona later; the server adds it, the app doesn't send it.
export const compareWritingRequestSchema = z.object({
  prompt: promptSchema,
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

// POST /ai/compare/vision — one photo, each model tags it as the prompt asks (how many tags too);
// the prompt is the same for every photo of a round.
export const compareVisionRequestSchema = z.object({
  prompt: promptSchema,
  image: visionImageSchema,
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

// POST /ai/tags — the assistant tags one photo with the user's Photo tags instructions and their
// chosen vision model; the app stores the tags on the asset, so they fit its schema.
export const tagPhotoRequestSchema = z.object({ image: visionImageSchema });
export type TagPhotoRequest = z.infer<typeof tagPhotoRequestSchema>;

export const tagPhotoResponseSchema = z.object({ tags: z.array(assetTagSchema).max(ASSET_TAG_LIMITS.tags) });
export type TagPhotoResponse = z.infer<typeof tagPhotoResponseSchema>;

// POST /ai/chat — the assistant chat: the writing model answers the transcript as the creator's
// collaborator, with post options only when asked, briefed by instructions.chatContext filled with
// their persona, Favorites and the post. Nothing is stored: the app sends the whole chat each time.
export const CHAT_LIMITS = {
  messages: 30,
  message: 4000,
  text: 4000,
  tags: 100,
  mentions: 30,
  mention: 80,
  posts: 10,
} as const;

// The chat's subject, a post open in the editor: 'draft' a new one, 'edit' one of the user's posts.
// PR 3 adds 'post' (a published post, outside the editor).
export const chatSubjectKindSchema = z.enum(['draft', 'edit']);
export type ChatSubjectKind = z.infer<typeof chatSubjectKindSchema>;

// What the chat is about, as the app sees it when it sends: the server fills the briefing with it
// (chatContext; `text` is its {caption}). The app cuts `text` to CHAT_LIMITS.text (a post's text has no cap) so a long caption never makes a 400.
export const chatContextSchema = z.object({
  kind: chatSubjectKindSchema,
  text: z.string().max(CHAT_LIMITS.text),
  media: z.object({ photo: z.number().int().min(0), video: z.number().int().min(0) }),
  tags: z.array(assetTagSchema).max(CHAT_LIMITS.tags),
  mentions: z.array(z.string().min(1).max(CHAT_LIMITS.mention)).max(CHAT_LIMITS.mentions),
});
export type ChatContext = z.infer<typeof chatContextSchema>;

// A reply: what the assistant says, and options for the post only when the user asked for posts.
export const chatReplySchema = z.object({
  reply: z.string().max(CHAT_LIMITS.message),
  postOptions: z.array(z.string().min(1)).max(CHAT_LIMITS.posts),
});
export type ChatReply = z.infer<typeof chatReplySchema>;

// The transcript so far: the user's turns and the assistant's replies, oldest first, ending with the
// user's new turn.
export const chatTurnSchema = z.union([
  z.object({ role: z.literal('user'), content: z.string().trim().min(1).max(CHAT_LIMITS.message) }),
  chatReplySchema.extend({ role: z.literal('assistant') }),
]);
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export const chatRequestSchema = z.object({
  context: chatContextSchema,
  messages: z
    .array(chatTurnSchema)
    .min(1)
    .max(CHAT_LIMITS.messages)
    .refine((turns) => turns[turns.length - 1]!.role === 'user', "The last turn is the user's"),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
