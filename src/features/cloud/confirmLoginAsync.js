import { Alert } from 'react-native';

export default function confirmLoginAsync() {
  return new Promise((resolve, reject) => {
    Alert.alert(
      'Confirm Login',
      'All existing data on this device is replaced with your cloud data. Are you sure you want to continue?',
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
