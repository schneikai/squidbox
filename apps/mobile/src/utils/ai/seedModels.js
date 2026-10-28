import { DEFAULT_MODEL_IDS } from '@squidbox/shared';

// Your models on first run, when Venice still has them (the owner's starting lists), each starting
// with the default model. The only model ids in the app besides the defaults and the verified models
// (packages/shared): everything else comes from Venice's catalog.
const SEED_MODEL_IDS = {
  writing: [DEFAULT_MODEL_IDS.writing, 'qwen-3-6-plus', 'z-ai-glm-5-3', 'grok-4-7', 'kimi-k3'],
  vision: [DEFAULT_MODEL_IDS.vision, 'venice-uncensored-1-2', 'deepseek-v4-1-flash-uncensored', 'qwen-3-6-plus'],
};

/** The first-run models of this kind that the catalog still offers, in the seed order. */
export default function seedModels(catalogOfKind, kind) {
  return SEED_MODEL_IDS[kind].flatMap((id) => catalogOfKind.filter((model) => model.id === id));
}
