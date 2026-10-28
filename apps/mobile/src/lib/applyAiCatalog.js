import aiCatalogStore from '@/lib/aiCatalogStore';

/** Puts a catalog the server answered (`{ models, defaults }`) in front of every screen. */
export default function applyAiCatalog({ models, defaults }) {
  aiCatalogStore.set({ models, defaults, error: null, at: Date.now() });
}
