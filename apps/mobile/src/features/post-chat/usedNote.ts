const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/**
 * The line under a reply whose option was used: "You used the first one", and in a thread " in post
 * N" (`post`, the post's number from 1; null outside a thread or for a post that was removed).
 */
export default function usedNote(index: number, post: number | null): string {
  const one = ORDINALS[index] ? `the ${ORDINALS[index]} one` : `option ${index + 1}`;
  return `You used ${one}${post === null ? '' : ` in post ${post}`}`;
}
