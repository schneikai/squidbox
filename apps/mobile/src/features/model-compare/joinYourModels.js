import modelsOfKind from './modelsOfKind';

/**
 * Your models (aiState) in your order, each with its catalog model, or `model: null` when Venice no
 * longer offers it for this kind ("No longer available").
 */
export default function joinYourModels(yourModels, catalog, kind) {
  const byId = new Map(modelsOfKind(catalog, kind).map((model) => [model.id, model]));
  return yourModels.map(({ id, name }) => ({ id, name, model: byId.get(id) ?? null }));
}
