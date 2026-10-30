/** A promise the test resolves when it wants to: a signal a stub gives, or one it waits for. */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}
