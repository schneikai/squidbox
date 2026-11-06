import { scale, space } from '@/styles/designTokens';

// How far each of a thread's stacked edges shows below the card above it, how far in each sits, and
// how tall each edge is (its top hides under the card).
const STACK_STEP = scale(7);
const STACK_INSET = space.md;
const EDGE_HEIGHT = scale(40);

/**
 * Where the stack edge for following post `index` sits (0 the front edge; any post past the last
 * edge sits behind it), from the top of the room under the first card, in a stack of `edgeCount`
 * edges: `top`, `height`, and `inset` from each side. The folded edges are drawn here, and an
 * unfolding thread's following posts start here; the last edge's bottom is the room the stack takes.
 */
export default function stackEdge(index: number, edgeCount: number) {
  'worklet';
  const depth = Math.min(index, edgeCount - 1) + 1;
  return { top: STACK_STEP * depth - EDGE_HEIGHT, height: EDGE_HEIGHT, inset: STACK_INSET * depth };
}
