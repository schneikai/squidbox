/** The sent fields that `current`, the record after the server's merge, holds with another value than the pushed `record`. */
export function lostFields(
  sent: string[],
  record: Record<string, unknown>,
  current: Record<string, unknown>,
): string[] {
  return sent.filter((field) => field in current && !Object.is(current[field], record[field]));
}
