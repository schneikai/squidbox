import { Alert } from 'react-native';

export default function confirmLoginAsync() {
  return new Promise((resolve) => {
    Alert.alert(
      'Confirm Login',
      'You will be logged in. Signing in as a different account replaces this device’s local library with that account’s data.',
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
