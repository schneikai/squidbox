// Fractional indexing: order keys that let you insert between two neighbors by minting a string
// strictly between their keys — so a reorder/insert touches only one edge row and concurrent
// edits on different devices don't collide. Keys sort lexicographically (plain string compare).
//
// Faithful port of the well-known `midpoint` algorithm (fractional-indexing), restricted to the
// pure-fractional form we need. Keys are strings over a base-36 alphabet; there is no integer
// prefix, so treat every key as the fractional part of a number in (0, 1).

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'; // sorted; ASCII order matches lexicographic

// Returns a string m with `a < m < b` (lexicographically). `a` is a digit string ('' = lower
// bound); `b` is a digit string or null (null = upper bound). Inputs must not end in the zero
// digit — an invariant every output already satisfies.
function midpoint(a: string, b: string | null): string {
  const zero = DIGITS[0];
  if (b !== null && a >= b) throw new Error(`fractionalIndex: ${a} >= ${b}`);
  if (a.slice(-1) === zero || (b && b.slice(-1) === zero)) {
    throw new Error('fractionalIndex: keys must not end in a zero digit');
  }
  if (b) {
    // Share the longest common prefix, then find a midpoint of the remainders.
    let n = 0;
    while ((a[n] || zero) === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return DIGITS[midDigit];
  }
  // Adjacent first digits: keep b's first digit if it has more, else descend into a's fraction.
  if (b && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), null);
}

/** Mint a key strictly between `a` and `b` (either may be null for the respective bound). */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) throw new Error(`fractionalIndex: ${a} >= ${b}`);
  return midpoint(a ?? '', b);
}

/** N increasing keys for an initial ordered list (e.g. the legacy converter's array → edges). */
export function initialKeys(n: number): string[] {
  const keys: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < n; i++) {
    prev = keyBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}
