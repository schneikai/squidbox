import type { AiModelKind, ApiAiModel } from '@squidbox/shared';

import modelsOfKind from '@/utils/ai/modelsOfKind';

/**
 * Your models in your order, each with its catalog model, or `model: null` when Venice no longer
 * offers it for this kind ("No longer available").
 */
export default function joinYourModels<E extends { id: string }>(
  yourModels: readonly E[],
  catalog: readonly ApiAiModel[],
  kind: AiModelKind,
): (E & { model: ApiAiModel | null })[] {
  const byId = new Map(modelsOfKind(catalog, kind).map((model) => [model.id, model]));
  return yourModels.map((entry) => ({ ...entry, model: byId.get(entry.id) ?? null }));
}
