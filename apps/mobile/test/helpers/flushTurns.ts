/** Lets pending promise callbacks and db queue turns run: ten turns of the event loop, no wall-clock wait. */
export async function flushTurns(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}
