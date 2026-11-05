/** A list route param (`ids.join(',')`) back as its list: empty when the param is missing or empty. */
export default function listParam(value: string | null | undefined): string[] {
  return value ? value.split(',') : [];
}
