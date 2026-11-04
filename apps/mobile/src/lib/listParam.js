/** A list route param (`ids.join(',')`) back as its list: empty when the param is missing or empty. */
export default function listParam(value) {
  return value ? value.split(',') : [];
}
