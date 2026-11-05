// A note as it is stored: trimmed, and null when nothing is left.
export default function noteText(text: string | null | undefined): string | null {
  return text?.trim() || null;
}
