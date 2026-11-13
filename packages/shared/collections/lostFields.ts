/**
 * The sent fields that `current`, the record after the server's merge, holds with another value than
 * the pushed `record`. A JSON field (a contact's places, a persona's lists) holds the pushed value when
 * equal by content: the stored row is another object, its keys in Postgres's order.
 */
export function lostFields(
  sent: string[],
  record: Record<string, unknown>,
  current: Record<string, unknown>,
): string[] {
  return sent.filter((field) => field in current && !sameValue(current[field], record[field]));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => key in b && sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
