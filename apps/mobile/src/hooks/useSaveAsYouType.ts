import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import useHaptics from '@/hooks/useHaptics';
import { requestSync } from '@/sync/worker';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';
import createAutoSaver from '@/utils/createAutoSaver';

/**
 * Stores `value` as it changes, the iOS Settings way: no Save button. A change is stored once typing
 * pauses, and at once on `flush()` (a field's blur), when the app goes to the background and when
 * the screen goes away, so nothing typed is lost; it syncs only then, so a half-typed record stays
 * on the device. `save(next, stored)`: see createAutoSaver. A failed save says so. Values compare by
 * their JSON.
 */
export default function useSaveAsYouType<T>(value: T, save: (next: T, stored: T) => Promise<void> | void) {
  const haptics = useHaptics();
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const hapticsRef = useRef(haptics);
  const [saver] = useState(() =>
    createAutoSaver<T>({
      value,
      save: (next, stored) => saveRef.current(next, stored),
      sync: requestSync,
      onError: (error) => {
        console.error('Saving failed', error);
        hapticsRef.current.error();
        Alert.alert("Couldn't save your changes", apiErrorMessage(error));
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
      saver.flush({ shouldSync: true });
    };
  }, [saver]);

  return saver;
}
