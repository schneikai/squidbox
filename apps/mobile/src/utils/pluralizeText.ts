export default function pluralizeText(singular: string, plural: string, count: number): string {
  // Replace '%{count}' with the actual count value
  const replacedSingular = singular.replace('%{count}', String(count));
  const replacedPlural = plural.replace('%{count}', String(count));

  // Return the singular or plural text based on the count
  return count === 1 ? replacedSingular : replacedPlural;
}
