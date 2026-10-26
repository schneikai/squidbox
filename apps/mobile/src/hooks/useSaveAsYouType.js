import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// How long typing may pause before what was typed is stored.
const SAVE_DELAY_MS = 600;

/**
 * Stores `value` as it changes, the iOS Settings way: no Save button. A change is saved once typing
 * pauses, and at once when the returned `flush()` is called (a field's blur), the app goes to the
 * background or the screen goes away, so nothing typed is lost. `save(next, previous, { isLeaving })`
 * gets the value and the last one saved (compare them to write only what changed); it may return
 * `false` to leave `next` unsaved for now (an empty required text, say, which it can drop for good
 * once `isLeaving`). Saves run one at a time, in order; a failed one is logged and tried again with
 * the next change. Values compare by their JSON.
 */
export default function useSaveAsYouType(value, save) {
  const key = JSON.stringify(value);
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const savedRef = useRef({ key, value });
  const queueRef = useRef(Promise.resolve());
  const timerRef = useRef(null);

  const flush = useCallback(({ isLeaving = false } = {}) => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = valueRef.current;
    const nextKey = JSON.stringify(next);
    if (nextKey === savedRef.current.key) return queueRef.current;
    const previous = savedRef.current;
    savedRef.current = { key: nextKey, value: next };
    queueRef.current = queueRef.current
      .then(() => saveRef.current(next, previous.value, { isLeaving }))
      .then((isSaved) => {
        if (isSaved === false && savedRef.current.key === nextKey) savedRef.current = previous;
      })
      .catch((error) => {
        console.error('Saving failed', error);
        if (savedRef.current.key === nextKey) savedRef.current = previous;
      });
    return queueRef.current;
  }, []);

  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
  });

  useEffect(() => {
    if (key === savedRef.current.key) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [key, flush]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => state !== 'active' && flush());
    return () => {
      subscription.remove();
      flush({ isLeaving: true });
    };
  }, [flush]);

  return flush;
}
