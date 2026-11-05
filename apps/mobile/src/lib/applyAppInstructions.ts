import type { PublishInstructionResponse } from '@squidbox/shared';

import aiCatalogStore from '@/lib/aiCatalogStore';

/** Puts the app's default instructions a publish answered (`{ instructions }`) in front of every screen. */
export default function applyAppInstructions({ instructions }: PublishInstructionResponse): void {
  aiCatalogStore.set((current) => ({ ...current, instructions }));
}
