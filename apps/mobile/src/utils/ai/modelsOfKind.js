/** The catalog's models a kind can use: all for writing, those that see photos for vision. */
export default function modelsOfKind(catalog, kind) {
  return kind === 'vision' ? catalog.filter((model) => model.supportsVision) : catalog;
}
