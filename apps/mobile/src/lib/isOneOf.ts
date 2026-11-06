/** A type guard for the members of `values`: `isOneOf(SORTS)(value)` says whether `value` is one. */
export default function isOneOf<const Values extends readonly unknown[]>(values: Values) {
  return (value: unknown): value is Values[number] => values.includes(value);
}
