import createStore from '@/lib/createStore';

// The catalog every screen that shows the models reads (useAiCatalog): Venice's models with
// Squidbox's marks, the model defaults and the app's default instructions. `at` is when it came in;
// a mark or a published instruction an ai_admin sets replaces it at once (applyAiCatalog).
const aiCatalogStore = createStore({ models: null, defaults: null, instructions: null, error: null, at: 0 });

export default aiCatalogStore;
