import aiCatalogStore from '@/lib/aiCatalogStore';

/** Puts a catalog the server answered (`{ models, defaults, instructions }`) in front of every screen. */
export default function applyAiCatalog({ models, defaults, instructions }) {
  aiCatalogStore.set({ models, defaults, instructions, error: null, at: Date.now() });
}
