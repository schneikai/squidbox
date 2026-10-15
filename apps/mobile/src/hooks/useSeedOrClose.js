import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import useCloseWhenGone from '@/hooks/useCloseWhenGone';
import { getDb } from '@/sync/db/client';

/**
 * What a screen starts from, read once per `key` (no live updates: the screen holds its own draft).
 * `read` resolves to `null` when the record is gone, which closes the screen with `goneMessage`; a
 * failed read closes it with the error. `undefined` while it reads.
 */
export default function useSeedOrClose(read, key, goneMessage) {
  const navigation = useNavigation();
  const [seed, setSeed] = useState();

  useEffect(() => {
    let isCancelled = false;
    read(getDb()).then(
      (result) => !isCancelled && setSeed(result),
      (error) => {
        console.error('Reading failed', error);
        if (isCancelled) return;
        Alert.alert("Couldn't open it", error.message);
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
