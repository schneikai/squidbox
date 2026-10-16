/** The post texts in `items`, trimmed and without empty ones, or null when fewer than `requiredCount` remain. */
export default function readVariations(items, requiredCount = 1) {
  if (!Array.isArray(items)) return null;
  const variations = items
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return variations.length >= requiredCount ? variations : null;
}
