export default function pluralizeText(singular, plural, count) {
  // Replace '%{count}' with the actual count value
  const replacedSingular = singular.replace('%{count}', count);
  const replacedPlural = plural.replace('%{count}', count);

  // Return the singular or plural text based on the count
  return count === 1 ? replacedSingular : replacedPlural;
}
