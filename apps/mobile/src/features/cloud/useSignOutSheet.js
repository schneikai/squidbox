import { useActionSheet } from '@expo/react-native-action-sheet';
import { Alert } from 'react-native';

import deviceLabel from '@/library/deviceLabel';
import unsyncedCountsText from '@/library/unsyncedCountsText';

// The sign-out choice: keep the library on this device or remove it, titled with what hasn't
// synced. Resolves { remove } or null for Cancel; removing anything unsynced asks once more.
export default function useSignOutSheet() {
  const { showActionSheetWithOptions } = useActionSheet();

  return function confirmSignOutAsync(counts) {
    const unsynced = unsyncedCountsText(counts);
    return new Promise((resolve) => {
      showActionSheetWithOptions(
        {
          title: unsynced ? `${unsynced} haven't synced yet` : 'Everything is synced',
          options: [`Keep on ${deviceLabel()}`, `Remove from ${deviceLabel()}`, 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) return resolve({ remove: false });
          if (index !== 1) return resolve(null);
          if (!unsynced) return resolve({ remove: true });
          Alert.alert(
            `Remove ${unsynced.replace(/(\d+) change/, '$1 unsynced change')}?`,
            "They haven't reached the cloud and will be lost.",
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              { text: 'Remove', style: 'destructive', onPress: () => resolve({ remove: true }) },
            ],
          );
        },
      );
    });
  };
}
