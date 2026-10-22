// A note as it is stored: trimmed, and null when nothing is left.
export default function noteText(text) {
  return text?.trim() || null;
}
