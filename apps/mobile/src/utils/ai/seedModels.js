import { DEFAULT_MODEL_IDS, VERIFIED_MODELS } from '@squidbox/shared';

// Your models on first run, when Venice still has them: for writing the verified models, for vision
// the owner's starting list, starting with the default model. The only model ids in the app besides
// the defaults and the verified models (packages/shared): everything else comes from Venice's catalog.
const SEED_MODEL_IDS = {
  writing: VERIFIED_MODELS.writing.map(({ id }) => id),
  vision: [DEFAULT_MODEL_IDS.vision, 'venice-uncensored-1-2', 'deepseek-v4-1-flash-uncensored', 'qwen-3-6-plus'],
};

/** The first-run models of this kind that the catalog still offers, in the seed order. */
export default function seedModels(catalogOfKind, kind) {
  return SEED_MODEL_IDS[kind].flatMap((id) => catalogOfKind.filter((model) => model.id === id));
}
