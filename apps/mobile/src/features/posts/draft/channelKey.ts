/** The key of the post's own channel as the editor opens. */
export const MAIN_KEY = 'main';

/** The key of the post's `n`th other channel in the editor's draft. */
export default function channelKey(n: number): string {
  return `channel-${n}`;
}
