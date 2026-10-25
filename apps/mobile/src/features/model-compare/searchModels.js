/** The models whose name or id holds `text`, ignoring case; all of them for blank text. */
export default function searchModels(models, text) {
  const query = text.trim().toLowerCase();
  if (!query) return models;
  return models.filter((model) => model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query));
}
