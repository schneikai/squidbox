import { Alert } from 'react-native';

import { CLEAR_DATA_BETWEEN_LOGINS } from '@/constants';

export default function confirmLoginAsync() {
  const message = CLEAR_DATA_BETWEEN_LOGINS
    ? 'All existing data on this device will be replaced with your cloud data. Are you sure you want to continue?'
    : 'You will be logged in. Your local data will not be affected.';

  return new Promise((resolve) => {
    Alert.alert(
      'Confirm Login',
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Login',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}
