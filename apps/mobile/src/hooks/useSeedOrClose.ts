import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { getDb } from '@/sync/db/client';
import type { SyncDb } from '@/sync/db/types';
import apiErrorMessage from '@/utils/cloud-api/apiErrorMessage';

/**
 * What a screen starts from, read once per `key` (no live updates: the screen holds its own draft).
 * `read` resolves to `null` when the record is gone, which closes the screen with `goneMessage`; a
 * failed read closes it with the error. `undefined` while it reads.
 */
export default function useSeedOrClose<T>(
  read: (db: SyncDb) => Promise<T | null>,
  key: string,
  goneMessage?: string,
): T | null | undefined {
  const navigation = useNavigation();
  const [seed, setSeed] = useState<T | null>();

  useEffect(() => {
    let isCancelled = false;
    read(getDb()).then(
      (result) => !isCancelled && setSeed(result),
      (error) => {
        console.error('Reading failed', error);
        if (isCancelled) return;
        Alert.alert("Couldn't open it", apiErrorMessage(error));
        navigation.goBack();
      },
    );
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per key
  }, [key]);

  useCloseWhenGone(seed, goneMessage);
  return seed;
}
