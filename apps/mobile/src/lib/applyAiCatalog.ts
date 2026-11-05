import type { AiModelsResponse } from '@squidbox/shared';

import aiCatalogStore from '@/lib/aiCatalogStore';

/** Puts a catalog the server answered (`{ models, defaults, instructions }`) in front of every screen. */
export default function applyAiCatalog({ models, defaults, instructions }: AiModelsResponse): void {
  aiCatalogStore.set({ models, defaults, instructions, error: null, at: Date.now() });
}
