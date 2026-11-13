// The error a cancelled transfer rejects with: an `AbortError`, like a cancelled fetch, which
// callers tell apart from a failure by its name (useRunWithProgress).
export default function cancelledError(message: string): Error {
  return Object.assign(new Error(message), { name: 'AbortError' });
}
