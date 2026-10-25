import isBlank from '@/utils/isBlank';

/** The models whose name or id holds `text`, ignoring case; all of them for blank text. */
export default function searchModels(models, text) {
  if (isBlank(text)) return models;
  const query = text.trim().toLowerCase();
  return models.filter((model) => model.name.toLowerCase().includes(query) || model.id.toLowerCase().includes(query));
}
