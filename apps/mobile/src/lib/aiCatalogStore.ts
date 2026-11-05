import type { ApiAiModel, Instructions, ModelDefaults } from '@squidbox/shared';

import createStore from '@/lib/createStore';

// The catalog every screen that shows the models reads (useAiCatalog): Venice's models with
// Squidbox's marks, the model defaults and the app's default instructions. `at` is when it came in;
// a mark an ai_admin sets replaces it at once (applyAiCatalog), a published instruction its
// instructions (applyAppInstructions).
export type AiCatalog = {
  models: ApiAiModel[] | null;
  defaults: ModelDefaults | null;
  instructions: Instructions | null;
  error: string | null;
  at: number;
};

const aiCatalogStore = createStore<AiCatalog>({ models: null, defaults: null, instructions: null, error: null, at: 0 });

export default aiCatalogStore;
