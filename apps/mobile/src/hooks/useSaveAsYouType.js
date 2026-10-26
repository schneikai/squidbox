import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import { requestSync } from '@/sync/worker';
import createAutoSaver from '@/utils/createAutoSaver';

/**
 * Stores `value` as it changes, the iOS Settings way: no Save button. A change is stored once typing
 * pauses, and at once on `flush()` (a field's blur), when the app goes to the background and when
 * the screen goes away, so nothing typed is lost; it syncs only then, so a half-typed record stays
 * on the device. `save(next, stored, { isLeaving })`: see createAutoSaver (`isLeaving` lets it drop
 * a new item left empty). `end(write)` runs a last write, such as a Delete, after the saves under
 * way, and saves nothing after it. A failed save says so. Values compare by their JSON.
 */
export default function useSaveAsYouType(value, save) {
  const haptics = useHaptics();
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const hapticsRef = useRef(haptics);
  const [saver] = useState(() =>
    createAutoSaver({
      value,
      save: (...args) => saveRef.current(...args),
      sync: requestSync,
      onError: (error) => {
        console.error('Saving failed', error);
        hapticsRef.current.error();
        Alert.alert("Couldn't save your changes", error.message);
      },
    }),
  );
  const key = JSON.stringify(value);

  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
    hapticsRef.current = haptics;
  });

  useEffect(() => {
    saver.change(valueRef.current);
  }, [saver, key]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => state !== 'active' && saver.flush({ shouldSync: true }),
    );
    return () => {
      subscription.remove();
      saver.flush({ isLeaving: true, shouldSync: true });
    };
  }, [saver]);

  return saver;
}
