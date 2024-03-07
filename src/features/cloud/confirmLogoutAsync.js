import { Alert } from 'react-native';

export default function confirmLogoutAsync() {
  return new Promise((resolve, reject) => {
    Alert.alert(
      'Confirm Logout',
      'All data on this device is removed. Are you sure you want to continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Logout',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}
