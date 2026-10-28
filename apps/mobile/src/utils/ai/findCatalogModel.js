/** The catalog's model with `id` (`models` from useAiCatalog), or null while loading or once Venice dropped it. */
export default function findCatalogModel(models, id) {
  return models?.find((model) => model.id === id) ?? null;
}
