/** A text's length as the counter counts it: code points, so a character outside the BMP counts once. */
export default function textLength(text: string): number {
  return [...text].length;
}
