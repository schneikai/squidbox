/** A handle as a contact stores it: as typed, trimmed; null when nothing is left. */
export default function storedHandle(typed: string): string | null {
  return typed.trim() || null;
}
