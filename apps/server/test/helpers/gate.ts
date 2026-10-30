/**
 * A stub's hold on its caller: `hold()` says it was reached (`entered`) and waits until the test
 * calls `release`.
 */
export function gate() {
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => (enter = resolve));
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  return {
    entered,
    release,
    hold: (): Promise<void> => {
      enter();
      return released;
    },
  };
}
