import { deferred } from './deferred';

/**
 * A stub's hold on its caller: `hold()` says it was reached (`entered`) and waits until the test
 * calls `release`, whose value it returns.
 */
export function gate<T = void>() {
  const entering = deferred();
  const releasing = deferred<T>();
  return {
    entered: entering.promise,
    release: releasing.resolve,
    hold: (): Promise<T> => {
      entering.resolve();
      return releasing.promise;
    },
  };
}
