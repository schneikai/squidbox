import aiCatalogStore from '@/lib/aiCatalogStore';

/** Puts the app's default instructions a publish answered (`{ instructions }`) in front of every screen. */
export default function applyAppInstructions({ instructions }) {
  aiCatalogStore.set((current) => ({ ...current, instructions }));
}
