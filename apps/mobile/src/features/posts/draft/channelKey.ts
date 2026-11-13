/** The key of the post's `n`th other channel in the editor's draft. */
export default function channelKey(n: number): string {
  return `channel-${n}`;
}
