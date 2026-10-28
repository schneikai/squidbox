import createStore from '@/lib/createStore';

// The catalog every screen that shows the models reads (useAiCatalog): Venice's models with
// Squidbox's marks, and the defaults. `at` is when it came in; a mark an ai_admin sets replaces it
// at once (applyAiCatalog).
const aiCatalogStore = createStore({ models: null, defaults: null, error: null, at: 0 });

export default aiCatalogStore;
