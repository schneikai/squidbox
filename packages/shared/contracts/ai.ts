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
  // Labelled Uncensored: `uncensoredOverride` where one is set, else Venice's own label
  // (`isVeniceUncensored`). apps/server/src/ai/catalog.ts works it out.
  isUncensored: z.boolean(),
  isVeniceUncensored: z.boolean(),
  // The kinds Squidbox verified the model for (the server's verified_models, set by an ai_admin).
  verifiedKinds: z.array(aiModelKindSchema),
  // The model's override of Venice's label, whatever the kind: true uncensored, false not, null
  // follows Venice.
  uncensoredOverride: z.boolean().nullable(),
  // Venice's reasoning capabilities, display only (nothing about it is sent to Venice): whether the
  // model reasons, and the effort it reasons at by default when Venice names one.
  reasoning: z.object({ supported: z.boolean(), defaultEffort: z.string().nullable() }),
  costPerReplyUsd: z.number(),
  costPer100PhotosUsd: z.number().nullable(),
});
export type ApiAiModel = z.infer<typeof apiAiModelSchema>;

// The model the assistant uses for a kind while the user chose none, per the persona's Adult content
// switch: `unrestricted` while it is on, `regular` while it is off.
export const MODEL_DEFAULT_VARIANTS = ['regular', 'unrestricted'] as const;
export const modelDefaultVariantSchema = z.enum(MODEL_DEFAULT_VARIANTS);
export type ModelDefaultVariant = z.infer<typeof modelDefaultVariantSchema>;

// What every account sees on a model, by the key the app and modelLabelLocks use.
export const MODEL_LABEL_NAMES = {
  verified: 'Verified',
  unrestricted: 'Unrestricted',
  default: 'Default',
  adultDefault: 'Default for Adult content',
} as const;
export type ModelLabel = keyof typeof MODEL_LABEL_NAMES;

const variantsSchema = z.object({ regular: z.string(), unrestricted: z.string() });
// The defaults of each kind, from the server's model_defaults (an ai_admin sets them in the app).
export const modelDefaultsSchema = z.object({ writing: variantsSchema, vision: variantsSchema });
export type ModelDefaults = z.infer<typeof modelDefaultsSchema>;

// GET /ai/models — also the answer of PUT /ai/verification, /ai/uncensored and /ai/defaults, so the app replaces
// its catalog with the new marks in one round trip.
export const aiModelsResponseSchema = z.object({ models: z.array(apiAiModelSchema), defaults: modelDefaultsSchema });
export type AiModelsResponse = z.infer<typeof aiModelsResponseSchema>;

// PUT /ai/verification/:kind/:modelId — whether the model is verified for the kind.
export const verificationRequestSchema = z.object({ isVerified: z.boolean() });
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;

// PUT /ai/uncensored/:modelId — whether the model counts as uncensored: true or false overrides
// Venice's label, null follows it.
export const uncensoredRequestSchema = z.object({ uncensored: z.boolean().nullable() });
export type UncensoredRequest = z.infer<typeof uncensoredRequestSchema>;

// PUT /ai/defaults/:kind/:variant — the model that becomes that default.
export const modelDefaultRequestSchema = z.object({ modelId: z.string().min(1) });
export type ModelDefaultRequest = z.infer<typeof modelDefaultRequestSchema>;

// The writing model that judges every turn of a writing Verify, the same for every model verified.
export const VERIFY_JUDGE_MODEL_ID = 'claude-sonnet-5-5';

// What a kind's Verify will do, known before it runs: its sections with each turn's prompt (writing:
// the creator's messages; vision: one section `photos` with the photo files).
export const verifyPlanSchema = z.object({
  sections: z.array(z.object({ id: z.string(), title: z.string(), prompts: z.array(z.string()) })),
});
export type VerifyPlan = z.infer<typeof verifyPlanSchema>;

/** How many turns a Verify of `plan` plays (a vision turn is a photo). */
export function verifyPlanTurns(plan: VerifyPlan): number {
  return plan.sections.reduce((count, section) => count + section.prompts.length, 0);
}

// The post a writing section started with.
export const verifyPostSchema = z.object({
  photos: z.number().int(),
  videos: z.number().int(),
  tags: z.array(z.string()),
  mentions: z.array(z.string()),
  caption: z.string(),
});
export type VerifyPost = z.infer<typeof verifyPostSchema>;

// One turn of a Verify. Writing: `prompt` the creator's message, `note` a sentence on the editor's
// change to the post before it, `items` the post options, the judge's verdict one of the `checks`.
// Vision: `prompt` the photo's file name, `reply` null, `items` the tags. A failed check's `reason`
// says what went wrong in words. `seconds` is the model's call only; `error` the reason the turn got
// no reply (its checks count as failed).
export const verifyTurnSchema = z.object({
  prompt: z.string(),
  note: z.string().nullable(),
  seconds: z.number().nullable(),
  unreadable: z.boolean(),
  reply: z.string().nullable(),
  items: z.array(z.string()),
  checks: z.array(z.object({ name: z.string(), ok: z.boolean(), reason: z.string().nullable() })),
  error: z.string().nullable(),
});
export type VerifyTurn = z.infer<typeof verifyTurnSchema>;

export const verifySectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  systemMessage: z.string().nullable(),
  post: verifyPostSchema.nullable(),
  turns: z.array(verifyTurnSchema),
});
export type VerifySection = z.infer<typeof verifySectionSchema>;

// A Verify's result so far: the turns by section, and the totals over them (`passes` and `fails`
// count checks).
export const verifyResultSchema = z.object({
  sections: z.array(verifySectionSchema),
  passes: z.number(),
  fails: z.number(),
  unreadable: z.number(),
  medianSeconds: z.number(),
  slowestSeconds: z.number(),
});
export type VerifyResult = z.infer<typeof verifyResultSchema>;

// `stopped`: the run didn't finish (Venice didn't answer, or the server stopped); `error` says why.
export const verifyRunStatusSchema = z.enum(['running', 'done', 'stopped']);
export type VerifyRunStatus = z.infer<typeof verifyRunStatusSchema>;

// A model's latest Verify run of a kind (the server keeps only that one).
export const verifyRunSchema = z.object({
  id: z.string(),
  kind: aiModelKindSchema,
  modelId: z.string(),
  status: verifyRunStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  turnsDone: z.number().int(),
  turnsTotal: z.number().int(),
  result: verifyResultSchema.nullable(),
  error: z.string().nullable(),
});
export type VerifyRun = z.infer<typeof verifyRunSchema>;

// GET and POST /ai/verify/:kind/:modelId — the latest run (null before the first) and the kind's
// plan; a POST starts one unless one is running, and answers it at once.
export const verifyRunResponseSchema = z.object({ run: verifyRunSchema.nullable(), plan: verifyPlanSchema });
export type VerifyRunResponse = z.infer<typeof verifyRunResponseSchema>;

// GET /ai/verify-photos — the vision Verify's photos, file name → data:image/jpeg;base64,… URL.
export const verifyPhotosResponseSchema = z.object({ photos: z.record(z.string(), z.string()) });
export type VerifyPhotosResponse = z.infer<typeof verifyPhotosResponseSchema>;

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
// collaborator, with post options only when asked, briefed by instructions.writing filled with
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

// What the chat is about, as the app sees it when it sends: the server fills the briefing with its
// media, tags, mentions and `text` (the {caption}); `kind` is only the app's (ChatSubjectCard), the
// default briefing doesn't name it. The app cuts `text` to CHAT_LIMITS.text (a post's text has no
// cap) so a long caption never makes a 400.
export const chatContextSchema = z.object({
  kind: chatSubjectKindSchema,
  text: z.string().max(CHAT_LIMITS.text),
  media: z.object({ photo: z.number().int().min(0), video: z.number().int().min(0) }),
  tags: z.array(assetTagSchema).max(CHAT_LIMITS.tags),
  mentions: z.array(z.string().min(1).max(CHAT_LIMITS.mention)).max(CHAT_LIMITS.mentions),
});
export type ChatContext = z.infer<typeof chatContextSchema>;

// A reply: what the assistant says, and options for the post only when the user asked for posts.
// `chatReplyFieldsSchema` is how the server reads a model's answer, unbounded (checkChatReply trims
// and cuts it to fit); `chatReplySchema` is the checked reply the app gets and sends back.
export const chatReplyFieldsSchema = z.object({ reply: z.string(), postOptions: z.array(z.string()) });
export const chatReplySchema = chatReplyFieldsSchema.extend({
  reply: chatReplyFieldsSchema.shape.reply.max(CHAT_LIMITS.message),
  postOptions: z.array(z.string().min(1).max(CHAT_LIMITS.message)).max(CHAT_LIMITS.posts),
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
