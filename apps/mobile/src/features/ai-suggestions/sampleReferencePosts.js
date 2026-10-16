import shuffle from '@/utils/shuffle';

// How many past posts a prompt includes as style reference.
const REFERENCE_SAMPLE_SIZE = 40;

/** A random subset of past posts, so repeated generations draw on different examples. */
export default function sampleReferencePosts(posts) {
  return shuffle(posts).slice(0, REFERENCE_SAMPLE_SIZE);
}
