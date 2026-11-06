/** `text` with the characters a RegExp gives a meaning escaped, to match it as it is. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
