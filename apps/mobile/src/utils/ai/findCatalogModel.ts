import type { ApiAiModel } from '@squidbox/shared';

/** The catalog's model with `id` (`models` from useAiCatalog), or null while loading or once Venice dropped it. */
export default function findCatalogModel(
  models: readonly ApiAiModel[] | null | undefined,
  id: string,
): ApiAiModel | null {
  return models?.find((model) => model.id === id) ?? null;
}
